import { TransfromCreate, TransfromInstance } from "../types";
import { isCallExpression } from "../utils";

const TRANSFORM_NAME = "V2Template";
const create: TransfromCreate = (params) => {
  const { id, magicString, options } = params;
  const staticRenderCall = new Map<number, any[]>();
  const result: TransfromInstance = {
    visitor: {},
    callback() {},
  };
  if (/\.vue/.test(id) && id.includes("type=template")) {
    result.visitor.leave = function leave(node, parent) {
      if (node.type === "VariableDeclarator") {
        if (
          (node as any).id.type === "Identifier" &&
          (node as any).id.name === "staticRenderFns" &&
          (node as any).init.type === "ArrayExpression"
        ) {
          const elements = (node as any).init.elements;
          elements.forEach((value, i) => {
            // 如果静态节点进行了 中文转换 则直接源码 _vm._m(0) 调用直接替换为 staticRenderFns调用
            if (
              isCallExpression(
                options.customI18n,
                magicString.slice(value.start, value.end)
              )
            ) {
              const nodes = staticRenderCall.get(i);
              if (nodes) {
                nodes.forEach((node) =>
                  magicString.overwrite(
                    node.start,
                    node.end,
                    `staticRenderFns[${i}].call(_vm._renderProxy, _vm._c, _vm)`
                  )
                );
              }
            }
          });
        }
      } else if (node.type === "CallExpression") {
        const { callee, arguments: args } = node as any;
        if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "_vm" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "_m"
        ) {
          if (typeof args[0]?.value === "number") {
             // 记录 _vm._m(index) 的调用
            if (staticRenderCall.has(args[0].value)) {
              staticRenderCall.get(args[0].value)!.push(node);
            } else {
              staticRenderCall.set(args[0].value, [node]);
            }
          }
        }
      }
    };
  }
  return result;
};

export default {
  name: TRANSFORM_NAME,
  create,
};
