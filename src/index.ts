import fs from "node:fs";
import { resolve } from "node:path";
import { createUnplugin, UnpluginFactory } from "unplugin";
import { Options, CompilerSuccess } from "./types";
import { createFilter } from "@rollup/pluginutils";
import MagicString from "magic-string";
import transformZH from "./transform/transformZH";
import transformV3Template from "./transform/transformV3Template";
import transformV2Template from "./transform/transformV2Template";
import {
  filterFile,
  walkAst,
  syncReadJson,
  generatorResultHtml,
  createFileHash,
} from "./utils";

export const transformsPresets = [
  transformZH,
  transformV3Template,
  transformV2Template,
];

export { createFileHash };

const RESULT_ID = "virtual:i18n-helper/result";
const OUTFILE = "_i18n_helper_result.html";

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

const pluginFactory: UnpluginFactory<Options> = (options) => {
  let outDir = "";
  const i18nMap: Map<string, Set<string>> = new Map(); // 记录解析结果
  const filter = createFilter(options.includes, options.exclude);
  const dictData = options.dictJson ? syncReadJson(options.dictJson) : null;
  return {
    name: "vite-plugin-i18n-helper",
    transformInclude(id) {
      return filter(id) && filterFile(id);
    },
    transform(code, id) {
      try {
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
            dictData,
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
    writeBundle() {
      try {
        if (options.output && outDir) {
          const file = resolve(outDir, OUTFILE);
          fs.writeFileSync(file, generatorResultHtml(i18nMap, dictData, true));
          console.log("i18n-helper-result: " + file);
        }
      } catch (error) {
        console.log("i18n-helper-result: 异常 ", error);
      }
    },
    vite: {
      configResolved(config) {
        outDir = config.build.outDir || "";
      },
      configureServer({ middlewares }) {
        // 添加中间件展示结果页
        middlewares.use(async (req, res, next) => {
          if (req.url && req.url.includes(RESULT_ID)) {
            const html = generatorResultHtml(i18nMap, dictData);
            res.setHeader("Content-Type", "text/html");
            res.setHeader("Cache-Control", "no-cache");
            res.statusCode = 200;
            return res.end(html);
          }
          next();
        });
      },
    },
    webpack(compiler) {
      outDir = compiler.options.output.path;
    },
  };
};

const unplugin = createUnplugin(pluginFactory);

export const vitePlugin = unplugin.vite;

export const webpackPlugin = unplugin.webpack;

export default unplugin;
