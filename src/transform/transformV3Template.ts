import { TransfromCreate, Visitor } from "../types";

export interface Result {
  name: string;
  start: number;
  end: number;
}

const hoistedReg = /^_hoisted_\d+$/;
const TRANSFORM_NAME = "V3Template";
const create: TransfromCreate<Result> = (id, options, magicString) => {
  const i18nReg = new RegExp(options.customI18n + "(.+)");
  const hoistedFlag = new Set<string>(); // 记录静态提升变量是否被国际化处理
  const hoistedCode = new Map<string, string>(); // 静态提升变量的代码
  const hoistedInitNode = new Map<string, any>(); // 静态提升变量的 ast 节点信息
  const parsedI18n = (start: number, end: number) => {
    return i18nReg.test(magicString.slice(start, end));
  };
  const parseProps = (pNode: any, dynamicPropsNode: any) => {
    const parseDynamicProps = (node: any) => {
      const { type } = node;
      if (type === "ArrayExpression") {
        return node;
      }
      if (type === "Identifier") {
        const hoistedNode = hoistedInitNode.get(node.name);
        return hoistedNode ? parseDynamicProps(hoistedNode) : null;
      }
      return null;
    };
    let node = pNode;
    if (pNode.type === "Identifier" && hoistedInitNode.has(pNode.name)) {
      node = hoistedInitNode.get(pNode.name);
    }
    if (node.type === "ObjectExpression" && parsedI18n(node.start, node.end)) {
      const props: string[] = [];
      const dNode = dynamicPropsNode
        ? parseDynamicProps(dynamicPropsNode)
        : null;
      const dynamicPropsCode = dNode
        ? magicString.slice(dNode.start, dNode.end).replace(/^\[|\]$/g, "")
        : "";
      const properties = node.properties || [];
      properties.forEach((p) => {
        const { key, value } = p;
        // 如果该属性包含 国际化代码片段 则可视为动态属性
        if (parsedI18n(value.start, value.end)) {
          const property = key.name || key.value;
          property &&
            !dynamicPropsCode.includes('"' + property + '"') &&
            props.push(property);
        }
      });
      if (props.length) {
        const str =
          "[" +
          (dynamicPropsCode ? `${dynamicPropsCode},` : "") +
          JSON.stringify(props).replace(/^\[|\]$/g, "") +
          "]";
        if (dynamicPropsNode && dynamicPropsNode.type === "Identifier") {
          magicString.overwrite(dNode.start, dNode.end, str);
          return "";
        }
        return str;
      }
    }
    return "";
  };
  const visitor: Visitor = /\.vue/.test(id)
    ? {
        enter(node) {
          const isIgnoreCall =
            node.type === "CallExpression" &&
            (node as any).callee.type === "Identifier" &&
            (node as any).callee.name === "_createCommentVNode";
          // 跳过注释节点
          if (isIgnoreCall) this.skip();
        },
        leave(node, parent) {
          if (node.type === "VariableDeclaration") {
            if (parent.type === "Program") {
              // 处理 const __hoisted_x = xxx   静态提升变量的声明代码
              const { declarations = [] } = node as any;
              declarations.forEach((dec) => {
                if (
                  dec.type === "VariableDeclarator" &&
                  dec.id.type === "Identifier" &&
                  hoistedReg.test(dec.id.name) &&
                  dec.init &&
                  (dec.init.type !== "ArrowFunctionExpression" ||
                    dec.init.type !== "FunctionExpression")
                ) {
                  const { start, end } = dec.init;
                  let code = magicString.slice(start, end);
                  const flag = parsedI18n(start, end);
                  if (
                    flag &&
                    dec.init.type === "CallExpression" &&
                    dec.init.callee.type === "Identifier" &&
                    dec.init.callee.name === "_withScopeId"
                  ) {
                    // 处理 _withScopeId(() => xxxx()) 中包含国际化代码
                    const arg = dec.init.arguments[0];
                    if (arg) {
                      code = magicString.slice(arg.body.start, arg.body.end);
                      magicString.overwrite(start, end, code);
                    }
                  }
                  // 记录静态提升数据
                  flag && hoistedFlag.add(dec.id.name);
                  hoistedCode.set(dec.id.name, code);
                  hoistedInitNode.set(dec.id.name, dec.init);
                }
              });
            }
          } else if (node.type === "Identifier") {
            if (parent.type !== "VariableDeclarator") {
              // 处理 使用 __hoisted_x 的代码
              const { name, start, end } = node as any;
              if (hoistedReg.test(name) && hoistedFlag.has(name)) {
                // 包含国际化处理的代码片段则视为失效的静态提升  需要替换为 源代码
                magicString.overwrite(
                  start,
                  end,
                  hoistedCode.get(name) as string
                );
              }
            }
          } else if (node.type === "CallExpression") {
            if ((node as any).callee.type === "Identifier") {
              // 处理  createVnode 等 节点创建 的函数调用表达式
              const calleeName = (node as any).callee.name;
              if (calleeName === "_createTextVNode") {
                // 处理文本节点
                const { start, end } = node as any;
                if (parsedI18n(start, end)) {
                  const args = (node as any).arguments;
                  args.length < 2
                    ? magicString.overwrite(end - 1, end, ",1)")
                    : magicString.overwrite(args[1].start, args[1].end, "1");
                }
              } else if (calleeName === "_createStaticVNode") {
                // 静态文本 todo
              } else if (/^_create([a-zA-Z]*(VNode|Block))$/.test(calleeName)) {
                const args = (node as any).arguments;
                if (args.length > 1) {
                  let patchFlag =
                    (args[3] &&
                      Number(magicString.slice(args[3].start, args[3].end))) ||
                    0;
                  let flag = patchFlag,
                    props = "";
                  // 处理 props  跳过全量对比的props标识
                  if (patchFlag < 0 || !(patchFlag & 16)) {
                    let pNode = args[1];
                    props = parseProps(pNode, args[4]);
                    if (props) {
                      if (patchFlag < 0) patchFlag = 0;
                      patchFlag |= 8;
                    }
                  }
                  const cNode = args[2];
                  // 处理 children  跳过动态文本
                  if (cNode && (patchFlag < 0 || !(patchFlag & 1))) {
                    if (parsedI18n(cNode.start, cNode.end)) {
                      // 如果是静态节点标识则清除
                      if (patchFlag < 0) patchFlag = 0;
                      // 设置为动态文本类型
                      if (
                        cNode.type === "Literal" ||
                        cNode.type === "BinaryExpression" ||
                        (cNode.type === "CallExpression" &&
                          cNode.callee.name === "_toDisplayString")
                      )
                        patchFlag |= 1;
                    }
                  }
                  // 如果 patchFlag 有改变 或者 有 存在中文的 props 则需要修改入参
                  if (flag !== patchFlag || props) {
                    let start = args[1].end;
                    let end = start + 1;
                    let code = "";
                    // 判断是否有 children 入参 如果有则从其后开始修改参数, 没有需要增加 children 为null 的参数 方便设置 patchFlag
                    if (args[2]) {
                      start = args[2].end;
                      end = start + 1;
                    } else {
                      code = ",null";
                    }
                    // 判断是否有 patchFlag 入参  如果有则从其后开始修改参数， 没有则需要增加 patchFlag
                    if (args[3]) {
                      start = args[3].start;
                      end = args[3].end;
                      code = patchFlag + "";
                    } else {
                      code += "," + patchFlag;
                    }
                    // 如果 有 props  则需要补上 或 覆盖 dynamicProps
                    if (props) {
                      // 如果有 dynamicProps 入参 则需要重写 dynamicProps
                      if (args[4]) {
                        end = args[4].end;
                      }
                      code += "," + props;
                    }
                    // 如果参数少于 4 个 则证明选取的 是 ')' 需要补上 ')' 保持闭合
                    if (args.length < 4) code += ")";
                    magicString.overwrite(start, end, code);
                  }
                }
              }
            }
          }
        },
      }
    : {};
  return {
    visitor,
  };
};

export default {
  name: TRANSFORM_NAME,
  create,
};
