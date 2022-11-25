import type { Plugin } from "vite";
import { Options, CompilerSuccess } from "./types";
import fs from "node:fs";
import { resolve } from "node:path";
import { createFilter } from "vite";
import MagicString from "magic-string";
import { walk } from "estree-walker";
import { JsonSubject, Observer } from "./observer";
import transformZH from "./transform/transformZH";
import transformV3Template from "./transform/transformV3Template";

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

function filterFile(id: string) {
  if (/\.(j|t)s(x?)$/.test(id)) return true;
  if (/\.vue/.test(id)) {
    if (id.endsWith(".vue")) return true;
    const [_, rawQuery = ""] = id.split("?", 2);
    const query = Object.fromEntries(new URLSearchParams(rawQuery));
    return query.vue != null && query.type === "script";
  }
  return false;
}

export default function (options: Options): Plugin {
  const dictJson = options.dictJson;
  let outDir = "";
  const i18nMap: Map<string, compilerResult> = new Map(); // 记录解析结果
  const ob = new Observer({});
  const sub = new JsonSubject();
  const filter = createFilter(options.includes, options.exclude);
  sub.add(ob);
  return {
    name: "vite-plugin-i18n-helper",
    transform(code, id) {
      if (!filter(id) || !filterFile(id)) return;
      const ast = this.parse(code);
      const magicString = new MagicString(code);
      const result: Map<string, any[]> = new Map();
      const compilerSuccess: CompilerSuccess<any> = ({ name, data }) => {
        const list = result.get(name) || [];
        list.push(data);
        result.set(name, list);
      };
      const transforms = loadTransforms(options.transforms || []);
      const visitorPlugin = transforms.map((p) =>
        p.create(
          id,
          options,
          magicString,
          dictJson ? ob.data : null,
          compilerSuccess
        )
      );
      walk(ast, {
        enter(...args) {
          visitorPlugin.forEach((plugin) => {
            plugin.visitor.enter && plugin.visitor.enter.apply(this, args);
          });
        },
        leave(...args) {
          visitorPlugin.forEach((plugin) => {
            plugin.visitor.leave && plugin.visitor.leave.apply(this, args);
          });
        },
      });
      transforms.forEach((p, i) => {
        const data = result.get(p.name) || [];
        const callback = visitorPlugin[i].callback;
        callback && callback(data);
      });
      const words = new Set(result.get(transformZH.name) || []);
      i18nMap.set(id, words);
      return {
        code: magicString.toString(),
      };
    },
    configResolved(config) {
      outDir = config.build.outDir || "";
      const isBuild = config.command === "build";
      if (dictJson) {
        if (isBuild) {
          // 读取文件配置
          sub.read(options.dictJson as string);
        } else {
          // 开启文件监控
          sub.startWatch(options.dictJson as string);
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

function generatorResultHtml(
  i18nMap: Map<string, compilerResult>,
  dict?: Record<string, string>,
  build?: boolean
) {
  function generator(
    title: string,
    completed: string[],
    unCompleted: string[]
  ) {
    let html = "";
    const hasCompleted = completed.length,
      hasUnCompleted = unCompleted.length;
    if (hasCompleted || hasUnCompleted) {
      html += `<div class="container">`;
      html += title ? `<h6>${title}</h6>` : "";
      html += `<div>${completed
        .map((v) => "<span class='completed'>" + v + "</span>")
        .join("")}</div>`;
      html += `<div>${unCompleted
        .map((v) => "<span class='un-completed'>" + v + "</span>")
        .join("")}</div>`;
      if (hasUnCompleted) {
        html += `<span class="un-completed" data-code>${JSON.stringify(
          unCompleted
        )}</span>`;
      }
      html += "</div>";
    }
    return html;
  }
  let content = "";
  if (build) {
    const completed: Set<string> = new Set(),
      unCompleted: Set<string> = new Set();
    i18nMap.forEach((val, k) => {
      val.forEach((k) => {
        !dict || dict[k] ? completed.add(k) : unCompleted.add(k);
      });
    });
    content += generator(
      "全部",
      Array.from(completed),
      Array.from(unCompleted)
    );
  } else {
    i18nMap.forEach((val, url) => {
      const completed: string[] = [],
        unCompleted: string[] = [];
      val.forEach((k) => {
        !dict || dict[k] ? completed.push(k) : unCompleted.push(k);
      });
      content += generator(url, completed, unCompleted);
    });
  }
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>i18n complier result</title>
      <style>
      * {margin: 0;padding:0}
      h6 {color: #FF2A3C;font-size: 16px;margin:10px 0;}
      .all, .completed,.un-completed{margin: 0 10px 10px 0;display:inline-block; padding: 2px 4px; border-radius: 4px;font-size: 14px;}
      .all {background: #FF2A3C}
      .un-completed {background: #F0AE45;}
      .completed {background: #22C179}
      .un-completed[data-code] {padding: 10px; border-radius:4px; background:#ccc; font-size: 12px}
      .btns {position: fixed;right:0;top:0;}
      .btns span {cursor: pointer;}
      </style>
    </head>
    <body>
    <div class="btns">
      <span class="all">全部</span>
      <span class="completed">已处理</span>
      <span class="un-completed">未处理</span>
    </div>
    ${content}
    </body>
    <script>
      document.querySelector(".btns").addEventListener("click",toggle)
      function toggle (event){
        if (event.target.tagName.toUpperCase() === 'SPAN') {
          const cls = event.target.className;
          const doms = document.querySelectorAll('.container span');
          Array.from(doms).forEach((dom) => {
            if (cls === 'all' || dom.className === cls) {
              dom.style.display = "";
            } else {
              dom.style.display = "none";
            }
          })
        }
      }
    </script>
  </html>
  `;
}
