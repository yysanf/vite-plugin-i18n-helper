import type { Plugin } from "vite";
import { Options, CompilerSuccess } from "./types";
import fs from "node:fs";
import { resolve } from "node:path";
import { createFilter } from "vite";
import MagicString from "magic-string";
import { JsonWatch, Observer } from "./utils/watch";
import transformZH from "./transform/transformZH";
import transformV3Template from "./transform/transformV3Template";
import { filterFile, walkAst, generatorResultHtml } from "./utils";

type compilerResult = Set<string>;

const RESULT_ID = "virtual:i18n-helper/result";
const OUTFILE = "_i18n_helper_result.html";

export const transformsPresets = [transformZH, transformV3Template];

function loadTransforms(transforms: Options["transforms"]) {
  const names = new Set([transformZH.name]);
  const result = [transformZH];
  if (transforms) {
    transforms.forEach((t) => {
      const value =
        typeof t === "string" ? transformsPresets.find((v) => v.name == t) : t;
      if (value && !names.has(value.name)) {
        result.push(value);
        names.add(value.name);
      }
    });
  }
  return result;
}

export default function (options: Options): Plugin {
  const dictJson = options.dictJson;
  let outDir = "";
  const i18nMap: Map<string, compilerResult> = new Map(); // 记录解析结果
  const ob = new Observer({});
  const watch = new JsonWatch(ob);
  const filter = createFilter(options.includes, options.exclude);
  return {
    name: "vite-plugin-i18n-helper",
    transform(code, id) {
      try {
        if (!filter(id) || !filterFile(id)) return;
        let ast = this.parse(code);
        const magicString = new MagicString(code);
        const result: Map<string, any[]> = new Map();
        const compilerSuccess: CompilerSuccess<any> = ({ name, data }) => {
          const list = result.get(name) || [];
          list.push(data);
          result.set(name, list);
        };
        const transforms = loadTransforms(options.transforms || []);
        const visitorPlugin = transforms.map((p) =>
          p.create({
            id,
            options,
            magicString,
            dictData: dictJson ? ob.data : null,
            success: compilerSuccess,
            pluginContext: this,
          })
        );
        walkAst(ast, visitorPlugin);
        transforms.forEach((p, i) => {
          const data = result.get(p.name) || [];
          const callback = visitorPlugin[i].callback;
          callback && callback(data);
        });
        const words = new Set(
          (result.get(transformZH.name) || []).map((val) => val.str)
        );
        i18nMap.set(id, words);
        return {
          code: magicString.toString(),
          map: magicString.generateMap({ source: id, includeContent: true }),
        };
      } catch (error) {
        this.warn({
          code: "PASE_ERROR",
          message: `i18n-helper-plugin: failed to parse ${id}`,
        });
        return null;
      }
    },
    configResolved(config) {
      outDir = config.build.outDir || "";
      const isBuild = config.command === "build";
      if (dictJson) {
        if (isBuild) {
          // 读取文件配置
          watch.read(options.dictJson as string);
        } else {
          // 开启文件监控
          watch.startWatch(options.dictJson as string);
        }
      }
    },
    closeBundle() {
      try {
        if (options.output && outDir) {
          const file = resolve(outDir, OUTFILE);
          fs.writeFileSync(
            file,
            generatorResultHtml(i18nMap, dictJson ? ob.data : void 0, true)
          );
          console.log("i18n-helper-result: " + file);
        }
      } catch (error) {
        console.log("i18n-helper-result: 异常 ", error);
      }
    },
    configureServer({ middlewares }) {
      // 添加中间件展示结果页
      middlewares.use(async (req, res, next) => {
        if (req.url && req.url.includes(RESULT_ID)) {
          const html = generatorResultHtml(
            i18nMap,
            dictJson ? ob.data : void 0
          );
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Cache-Control", "no-cache");
          res.statusCode = 200;
          return res.end(html);
        }
        next();
      });
    },
  };
}
