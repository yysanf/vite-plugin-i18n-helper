import { TransfromCreate, Visitor } from "../types";
import { isZH, overwriteZH } from "../utils";

const name = "transformZH";

const create: TransfromCreate = ({
  options,
  magicString,
  dictData,
  success,
}) => {
  const handlerIgnore = (value: string, start: number) => {
    const ignoreMark =
      typeof options.ignoreMark === "string" ? options.ignoreMark : "i18n!:";
    if (ignoreMark && value.indexOf(ignoreMark) == 0) {
      magicString.overwrite(start + 1, start + 1 + ignoreMark.length, "");
      return true;
    }
  };
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
        if (
          typeof value === "string" &&
          isZH(value) &&
          !handlerIgnore(value, start)
        ) {
          const result = overwriteZH(
            value,
            [],
            options,
            options.dictJson ? dictData : null
          );
          if (result) {
            magicString.overwrite(start, end, result.code);
            success({ name, data: result });
          }
        }
      } else if (node.type === "TemplateLiteral") {
        const { expressions, quasis, start, end } = node as any;
        const str = quasis.map((n) => n.value.cooked);
        if (isZH(str.join(",")) && !handlerIgnore(str[0], start)) {
          // 获取参数
          const args = expressions.map((val) =>
            magicString.slice(val.start, val.end)
          );
          const result = overwriteZH(
            str,
            args,
            options,
            options.dictJson ? dictData : null
          );
          if (result) {
            magicString.overwrite(start, end, result.code);
            success({ name, data: result });
          }
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
          `import {${options.customI18n}} from "${options.customI18nUrl}";`
        );
      }
    },
  };
};

export default {
  name,
  create,
};
