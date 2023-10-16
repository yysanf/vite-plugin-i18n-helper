import MagicString from "magic-string";
import { TransfromCreate, TransfromInstance } from "../types";
import { isCallExpression, isZH, walkAst } from "../utils";
import { parseHTML } from "../utils/parse";
import transformZH from "./transformZH";

type HoistedFlag = Map<string, number>;
type HoistedCode = Map<string, string>;
type HoistedInitNode = Map<string, any>;


const calleNameMap = {
  element: "createElementVNode",
  text: "createTextVNode",
  static: "createStaticVNode",
  comment: "createCommentVNode",
};

function getVnodeCallName(name: string) {
  return "_" + calleNameMap[name];
}

const WITHSCOPEID = "_withScopeId";

enum PatchFlag {
  TEXT = 1,
  PROPS = 1 << 3,
  FULL_PROPS = 1 << 4,
}

// 解析动态props
const parseProps = (data: {
  pNode: any;
  dynamicPropsNode: any;
  hoistedInitNode: HoistedInitNode;
  magicString: MagicString;
  customI18n: string;
}) => {
  const { pNode, dynamicPropsNode, hoistedInitNode, magicString, customI18n } =
    data;
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
  if (
    node.type === "ObjectExpression" &&
    isCallExpression(customI18n, magicString.slice(node.start, node.end))
  ) {
    const props: string[] = [];
    const dNode = dynamicPropsNode ? parseDynamicProps(dynamicPropsNode) : null;
    const dynamicPropsCode = dNode
      ? magicString.slice(dNode.start, dNode.end).replace(/^\[|\]$/g, "")
      : "";
    const properties = node.properties || [];
    properties.forEach((p) => {
      const { key, value } = p;
      // 如果该属性包含 国际化代码片段 则可视为动态属性
      if (
        isCallExpression(customI18n, magicString.slice(value.start, value.end))
      ) {
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
const hoistedReg = /^_hoisted_\d+$/;
const TRANSFORM_NAME = "V3Template";
const parser = parseHTML();
const create: TransfromCreate = (params) => {
  const { id, options, magicString, pluginContext } = params;
  const hoistedFlag: HoistedFlag = new Map(); // 记录静态提升变量是否被国际化处理
  const hoistedCode: HoistedCode = new Map(); // 静态提升变量的代码
  const hoistedInitNode: HoistedInitNode = new Map(); // 静态提升变量的 ast 节点信息
  const imports = new Set<string>();
  const calleeVNode = new Set<string>();
  const getVNodeCallee = (name: string) => {
    calleeVNode.add(name);
    return getVnodeCallName(name);
  };
  const parsedI18n = (start: number, end: number) => {
    return isCallExpression(options.customI18n, magicString.slice(start, end));
  };
  const result: TransfromInstance = {
    visitor: {},
    callback() {
      if (calleeVNode.size) {
        const arr: string[] = [];
        calleeVNode.forEach((val) => {
          const calleeName = getVnodeCallName(val);
          if (!imports.has(calleeName)) {
            arr.push(calleNameMap[val] + " as " + calleeName);
          }
        });
        if (arr.length) {
          magicString.prepend(`import {${arr.join(",")}} from "vue";`);
        }
      }
    },
  };
  if (/\.vue/.test(id)) {
    result.visitor.enter = function enter(node) {
      if (
        node.type === "CallExpression" &&
        (node as any).callee.type === "Identifier"
      ) {
        const calleeName = (node as any).callee.name;
        if (
          calleeName === getVnodeCallName("comment") ||
          calleeName === getVnodeCallName("static")
        ) {
          this.skip();
        }
      }
    };
    result.visitor.leave = function leave(node, parent) {
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
              let flag = parsedI18n(start, end) ? 1 : 0;
              if (
                dec.init.type === "CallExpression" &&
                dec.init.callee.type === "Identifier"
              ) {
                // 处理 _withScopeId(() => xxxx()) 中包含国际化代码
                if (flag && dec.init.callee.name === WITHSCOPEID) {
                  const arg = dec.init.arguments[0];
                  if (arg) {
                    code = magicString.slice(arg.body.start, arg.body.end);
                  }
                }
                // 处理 静态节点
                if (dec.init.callee.name === getVnodeCallName("static")) {
                  const arg = dec.init.arguments[0];
                  if (arg) {
                    const staticStr = magicString.slice(arg.start, arg.end);
                    const htmlStr = new Function("return " + staticStr)();
                    if (isZH(htmlStr)) {
                      try {
                        const staticCode = parser(htmlStr, getVNodeCallee);
                        const staticAst = pluginContext.parse(staticCode);
                        const magicStr = new MagicString(staticCode);
                        const transformParams = {
                          ...params,
                          magicString: magicStr,
                        };
                        const visitorList = [
                          create(transformParams),
                          transformZH.create(transformParams),
                        ];
                        walkAst(staticAst, visitorList);
                        code = magicStr.toString();
                        if (isCallExpression(options.customI18n, code))
                          flag = 2;
                      } catch (error) {
                        pluginContext.warn({
                          code: "PASE_ERROR",
                          message: `i18n-helper-plugin: ${TRANSFORM_NAME} failed to parse code ${htmlStr} in file ${id} `,
                        });
                      }
                    }
                  }
                }
              }
              // 记录静态提升数据
              hoistedFlag.set(dec.id.name, flag);
              hoistedCode.set(dec.id.name, code);
              hoistedInitNode.set(dec.id.name, dec.init);
            }
          });
        }
      } else if (node.type === "Identifier") {
        if (parent.type !== "VariableDeclarator") {
          // 处理 使用 __hoisted_x 的代码
          const { name, start, end } = node as any;
          if (hoistedReg.test(name)) {
            const flag = hoistedFlag.get(name) as number;
            if (flag > 0) {
              // 包含国际化处理的代码片段则视为失效的静态提升  需要替换为 源代码
              let code = hoistedCode.get(name) as string;
              if (flag === 2 && parent.type === "ReturnStatement")
                code = "[" + code + "]";
              magicString.overwrite(start, end, code);
            }
          }
        }
      } else if (node.type === "CallExpression") {
        if ((node as any).callee.type === "Identifier") {
          // 处理  createVnode 等 节点创建 的函数调用表达式
          const calleeName = (node as any).callee.name;
          if (calleeName === getVnodeCallName("text")) {
            // 处理文本节点
            const { start, end } = node as any;
            if (parsedI18n(start, end)) {
              const args = (node as any).arguments;
              args.length < 2
                ? magicString.overwrite(end - 1, end, ",1)")
                : magicString.overwrite(args[1].start, args[1].end, "1");
            }
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
              if (patchFlag < 0 || !(patchFlag & PatchFlag.FULL_PROPS)) {
                let pNode = args[1];
                props = parseProps({
                  pNode,
                  dynamicPropsNode: args[4],
                  hoistedInitNode,
                  magicString,
                  customI18n: options.customI18n,
                });
                if (props) {
                  if (patchFlag < 0) patchFlag = 0;
                  patchFlag |= PatchFlag.PROPS;
                }
              }
              const cNode = args[2];
              // 处理 children  跳过动态文本
              if (cNode && (patchFlag < 0 || !(patchFlag & PatchFlag.TEXT))) {
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
                    patchFlag |= PatchFlag.TEXT;
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
                  if (args[4]) end = args[4].end;
                  code += "," + props;
                }
                // 如果参数少于 4 个 则证明选取的 是 ')' 需要补上 ')' 保持闭合
                if (args.length < 4) code += ")";
                magicString.overwrite(start, end, code);
              }
            }
          }
        }
      } else if (node.type === "ImportDeclaration") {
        (node as any).specifiers.forEach((specifier) => {
          imports.add(specifier.local.name);
        });
      }
    };
  }
  return result;
};

export default {
  name: TRANSFORM_NAME,
  create,
};
