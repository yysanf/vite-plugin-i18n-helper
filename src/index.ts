import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import { createFilter } from "vite";
import MagicString from "magic-string";
import { walk } from "estree-walker";
import { JsonSubject, Observer } from "./observer";

interface Options {
  customI18n: string;
  customI18nUrl: string;
  dictJson?: string;
  includes?: Array<string | RegExp> | string | RegExp;
  exclude?: Array<string | RegExp> | string | RegExp;
  ignoreMark?: string;
  raw?: boolean;
  output?: boolean;
}
type compilerResult = Set<string>;

const RESULT_ID = "virtual:i18n-helper/result";
const OUTFILE = "_i18n_helper_result.html";

function isCN(code: string) {
  return /[\u4E00-\u9FFF]/gmu.test(code);
}

export default function (options: Options): Plugin {
  let outDir = "";
  const i18nMap: Map<string, compilerResult> = new Map(); // 记录解析结果
  const ob = new Observer({});
  const sub = new JsonSubject();
  const hasDict = !!options.dictJson;
  const ignoreMark =
    typeof options.ignoreMark === "string" ? options.ignoreMark : "i18n!:";
  const filter = createFilter(options.includes, options.exclude);
  sub.add(ob);
  return {
    name: "vite-plugin-i18n-helper",
    transform(code, id) {
      if (!filter(id) || !/\.(j|t)s(x?)|vue$/.test(id)) return;
      const ast = this.parse(code);
      const magicString = new MagicString(code);
      let write = false;
      const result: compilerResult = new Set(); // 存储当前解析内容
      function compiler(str: string, args: string[]) {
        let prefix = str,
          suffix = "",
          fnStr = "";
        suffix = str = str.replace(/^\s+/, "");
        prefix = prefix.replace(str, "");
        str = str.replace(/\s+$/, "");
        suffix = suffix.replace(str, "");
        result.add(str);
        const code = hasDict ? ob.data[str] : str;
        if (code) {
          const rawStr = options.raw ? "," + JSON.stringify(str) : "";
          const argsStr = args.length
            ? `,[${args.map((v) => v).join(",")}]`
            : rawStr
            ? ",null"
            : "";
          fnStr = `${options.customI18n}(${JSON.stringify(
            code
          )}${argsStr}${rawStr})`;
          if (prefix || suffix) {
            fnStr = "`" + prefix + "${" + fnStr + "}" + suffix + "`";
          }
        }
        return fnStr;
      }
      function overwrite(
        start: number,
        end: number,
        value: string,
        args: string[]
      ) {
        if (ignoreMark && value.indexOf(ignoreMark) == 0) {
          magicString.overwrite(start + 1, start + 1 + ignoreMark.length, "");
          return;
        }
        const code = compiler(value, args);
        if (code) {
          magicString.overwrite(start, end, code);
          write = true;
        }
      }
      walk(ast, {
        enter(node) {
          const isConsole =
            (node as any).type == "CallExpression" &&
            (node as any).callee.type == "MemberExpression" &&
            (node as any).callee.object.type == "Identifier" &&
            (node as any).callee.object.name == "console";
          const isIgnoreCall =
            node.type == "CallExpression" &&
            (node as any).callee.type == "Identifier" &&
            ((node as any).callee.name == options.customI18n ||
              (node as any).callee.name == "_createCommentVNode");
          // 忽略console 和 一些调用方法
          if (isConsole || isIgnoreCall) {
            this.skip();
          }
        },
        leave(node) {
          if (node.type == "Literal") {
            const { value, start, end } = node as any;
            if (typeof value === "string" && isCN(value)) {
              overwrite(start, end, value, []);
            }
          } else if (node.type === "TemplateLiteral") {
            const { expressions, quasis, start, end } = node as any;
            let len = quasis.length - 1;
            // 组装成 xxx{0}xxx{1}
            const str = quasis
              .map((n, i) => n.value.cooked + (len == i ? "" : `{${i}}`))
              .join("");
            if (typeof str === "string" && isCN(str)) {
              // 获取参数
              const args = expressions.map((val) =>
                magicString.slice(val.start, val.end)
              );
              overwrite(start, end, str, args);
            }
          }
        },
      });
      if (write) {
        const imports = new Set();
        (ast as any).body.forEach((node) => {
          if (node.type === "ImportDeclaration") {
            node.specifiers.forEach((specifier) => {
              imports.add(specifier.local.name);
            });
          }
        });
        if (!imports.has(options.customI18n)) {
          // 自动导入 i18n 方法
          magicString.prepend(
            `\nimport {${options.customI18n}} from "${options.customI18nUrl}"\n`
          );
        }
      }
      i18nMap.set(id, result);
      return {
        code: magicString.toString(),
      };
    },
    buildStart() {
      hasDict && sub.read(options.dictJson as string);
    },
    outputOptions(opt) {
      outDir = opt.dir || "";
    },
    closeBundle() {
      try {
        if (options.output && outDir) {
          const file = path.resolve(outDir, OUTFILE);
          fs.writeFileSync(
            file,
            generatorResultHtml(i18nMap, hasDict ? ob.data : void 0, true)
          );
          console.log("i18n-helper-result: " + file);
        }
      } catch (error) {
        console.log("i18n-helper-result: 异常 ", error);
      }
    },
    configureServer({ middlewares }) {
      // 开启文件监控
      if (hasDict) {
        sub.startWatch(options.dictJson as string);
      }
      // 添加中间件展示结果页
      middlewares.use(async (req, res, next) => {
        if (req.url && req.url.includes(RESULT_ID)) {
          const html = generatorResultHtml(i18nMap, hasDict ? ob.data : void 0);
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
