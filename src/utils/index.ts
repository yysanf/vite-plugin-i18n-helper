import { type BaseNode, walk } from "estree-walker";
import { Options, TransfromInstance } from "../types";

// 匹配中文
export function isZH(code: string) {
  return /[\u4E00-\u9FFF]/gmu.test(code);
}

export function isCallExpression(calleeName: string, str: string) {
  return new RegExp(calleeName + "\\(.+\\)").test(str);
}

// 生成国际化代码
function genI18nCode(
  customI18n: string,
  str: string,
  args: string[],
  prefix: string,
  suffix: string,
  rawVal?: string
) {
  const rawStr = rawVal ? "," + JSON.stringify(rawVal) : "";
  const argsStr = args.length
    ? `,[${args.map((v) => v).join(",")}]`
    : rawStr
    ? ",null"
    : "";
  let fnStr = `${customI18n}(${JSON.stringify(str)}${argsStr}${rawStr})`;
  if (prefix || suffix) {
    fnStr = "`" + prefix + "${" + fnStr + "}" + suffix + "`";
  }
  return fnStr;
}

function splitByReg(str: string, reg: RegExp) {
  const match = str.match(reg);
  return [str.replace(reg, ""), match ? match[0] : ""];
}

// 重写中文
export function overwriteZH(
  value: string | string[],
  args: string[],
  options: Options,
  dict: Record<string, string> | null
) {
  const ignorePrefix = options.ignorePrefix || /^\s+/;
  const ignoreSuffix = options.ignoreSuffix || /\s+$/;
  const customI18n = options.customI18n;
  let str, prefix, suffix;
  if (Array.isArray(value)) {
    const arr = value.slice(),
      len = value.length - 1;
    [arr[0], prefix] = splitByReg(arr[0], ignorePrefix);
    [arr[len], suffix] = splitByReg(arr[len], ignoreSuffix);
    str = arr.map((s, i) => s + (i < len ? `{${i}}` : "")).join("");
  } else {
    [str, prefix] = splitByReg(value, ignorePrefix);
    [str, suffix] = splitByReg(str, ignoreSuffix);
  }
  const key = dict ? dict[str] : str;
  let code = "";
  if (key) {
    code =
      "/*#__PURE__*/" +
      genI18nCode(
        customI18n,
        key,
        args,
        prefix,
        suffix,
        options.raw ? str : void 0
      );
    return { str, code };
  }
}

// 匹配文件后缀
export function filterFile(id: string) {
  if (/\.(j|t)s(x?)$/.test(id)) return true;
  if (/\.vue/.test(id)) {
    if (id.endsWith(".vue")) return true;
    const [_, rawQuery = ""] = id.split("?", 2);
    const query = Object.fromEntries(new URLSearchParams(rawQuery));
    return query.vue != null && query.type === "script";
  }
  return false;
}

// 遍历ast
export function walkAst(ast: BaseNode, visitorPlugin: TransfromInstance[]) {
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
}

// 生成结果html
export function generatorResultHtml(
  i18nMap: Map<string, Set<string>>,
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
