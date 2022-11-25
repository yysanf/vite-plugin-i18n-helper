import { Options, TransfromCreate, Visitor } from "../types";
import MagicString from "magic-string";

const name = "transformZH";
function compiler(
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

function isZH(code: string) {
  return /[\u4E00-\u9FFF]/gmu.test(code);
}

function splitByIgnoreReg(str: string, reg: RegExp) {
  const match = str.match(reg);
  return [str.replace(reg, ""), match ? match[0] : ""];
}

function overwrite(
  magicString: MagicString,
  start: number,
  end: number,
  value: string | string[],
  args: string[],
  options: Options,
  dict: Record<string, string> | null
) {
  const ignoreMark =
    typeof options.ignoreMark === "string" ? options.ignoreMark : "i18n!:";
  if (
    ignoreMark &&
    (Array.isArray(value) ? value[0] : value).indexOf(ignoreMark) == 0
  ) {
    magicString.overwrite(start + 1, start + 1 + ignoreMark.length, "");
    return;
  }
  const ignorePrefix = options.ignorePrefix || /^\s+/;
  const ignoreSuffix = options.ignoreSuffix || /\s+$/;
  const customI18n = options.customI18n;
  let str, prefix, suffix;
  if (Array.isArray(value)) {
    const arr = value.slice(),
      len = value.length - 1;
    [arr[0], prefix] = splitByIgnoreReg(arr[0], ignorePrefix);
    [arr[len], suffix] = splitByIgnoreReg(arr[len], ignoreSuffix);
    str = arr.map((s, i) => s + (i < len ? `{${i}}` : "")).join("");
  } else {
    [str, prefix] = splitByIgnoreReg(value, ignorePrefix);
    [str, suffix] = splitByIgnoreReg(str, ignoreSuffix);
  }
  const key = dict ? dict[str] : str;
  let code = "";
  if (key) {
    code = compiler(
      customI18n,
      key,
      args,
      prefix,
      suffix,
      options.raw ? str : void 0
    );
    magicString.overwrite(start, end, code);
  }
  return { str, code };
}

type Result = { code: string; str: string };

const create: TransfromCreate<Result> = (
  _id,
  options,
  magicString,
  dictData,
  success
) => {
  const imports = new Set();
  const visitor: Visitor = {
    enter(node) {
      const isConsole =
        (node as any).type == "CallExpression" &&
        (node as any).callee.type == "MemberExpression" &&
        (node as any).callee.object.type == "Identifier" &&
        (node as any).callee.object.name == "console";
      const isIgnoreCall =
        node.type == "CallExpression" &&
        (node as any).callee.type == "Identifier" &&
        (node as any).callee.name == options.customI18n;
      // 忽略console 和 一些调用方法
      if (isConsole || isIgnoreCall) {
        this.skip();
      } else if (node.type === "ImportDeclaration") {
        (node as any).specifiers.forEach((specifier) => {
          imports.add(specifier.local.name);
        });
      }
    },
    leave(node) {
      if (node.type == "Literal") {
        const { value, start, end } = node as any;
        if (typeof value === "string" && isZH(value)) {
          const result = overwrite(
            magicString,
            start,
            end,
            value,
            [],
            options,
            options.dictJson ? dictData : null
          );
          result && success({ name, data: result });
        }
      } else if (node.type === "TemplateLiteral") {
        const { expressions, quasis, start, end } = node as any;
        const str = quasis.map((n) => n.value.cooked);
        if (isZH(str.join(","))) {
          // 获取参数
          const args = expressions.map((val) =>
            magicString.slice(val.start, val.end)
          );
          const result = overwrite(
            magicString,
            start,
            end,
            str,
            args,
            options,
            options.dictJson ? dictData : null
          );
          result && success({ name, data: result });
        }
      }
    },
  };
  return {
    visitor,
    callback(result) {
      const hasCode = result.some((v: any) => !!v.code);
      if (hasCode && !imports.has(options.customI18n)) {
        // 自动导入 i18n 方法
        magicString.prepend(
          `\nimport {${options.customI18n}} from "${options.customI18nUrl}"\n`
        );
      }
    },
  };
};

export default {
  name,
  create,
};
