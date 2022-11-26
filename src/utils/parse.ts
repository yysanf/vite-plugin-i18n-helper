import { Parser } from "htmlparser2";

interface VNode {
  name: string;
  type: string;
  attr: Record<string, any>;
  children: VNode[];
  code: string;
}

type VnodeCallee = (val: string) => string;

const PURE_CODE = "/*#__PURE__*/";
export function parseHTML() {
  let parser: Parser;
  const root: VNode = {
    name: "",
    type: "root",
    attr: {},
    children: [],
    code: "",
  };
  const stack: VNode[] = [root];
  let nodeCallee: VnodeCallee | undefined;
  function getParser() {
    if (parser) return parser;
    parser = new Parser({
      onopentag(name, attr) {
        const current = {
          name,
          attr,
          type: "element",
          children: [],
          code: "",
        };
        const parent = stack[stack.length - 1];
        parent.children.push(current);
        stack.push(current);
      },
      ontext(text) {
        const current = {
          name: text,
          attr: {},
          type: "text",
          children: [],
          code: "",
        };
        const parent = stack[stack.length - 1];
        const prev = parent.children.pop();
        if (prev && prev.type === "text") {
          current.name = prev.name + current.name;
        }
        parent.children.push(current);
      },
      onclosetag() {
        const current = stack.pop() as VNode;
        current.code = genVNodeCode(current, nodeCallee as VnodeCallee);
      },
    });
  }
  return function (str: string, getVNodeCallee: VnodeCallee) {
    nodeCallee = getVNodeCallee;
    getParser();
    parser.write(str);
    parser.reset();
    const code = root.children.map((c) => c.code).join(",");
    root.children.length = 0;
    stack.length = 0;
    stack.push(root);
    nodeCallee = void 0;
    return code;
  };
}
function genVNodeCode(node: VNode, getVNodeCallee: VnodeCallee) {
  const { children, name, attr, type } = node;
  let childrenCode: string = "";
  if (children.length === 1 && children[0].type === "text") {
    childrenCode = JSON.stringify(children[0].name);
  } else {
    childrenCode = children
      .map((c) => {
        if (c.type === "text") {
          const calleeName = getVNodeCallee(c.type);
          return `${PURE_CODE}${calleeName}("${c.name}",-1)`;
        }
        return c.code;
      })
      .join(",");
    childrenCode = childrenCode ? "[" + childrenCode + "]" : "null";
  }
  const keys = Object.keys(attr);
  let len = keys.length;
  keys.forEach((k) => {
    if (/^data-v-[a-zA-Z\d]+$/.test(k)) {
      delete attr[k];
      len--;
    }
  });
  const calleeName = getVNodeCallee(type);
  const code = `${PURE_CODE}${calleeName}("${name}", ${
    len ? JSON.stringify(attr) : "null"
  }, ${childrenCode},-1)`;
  return code;
}
