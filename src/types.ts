import { walk } from "estree-walker";
import MagicString from "magic-string";

export declare interface Options {
  customI18n: string;
  toI18nCodeFunc?: string[];
  customI18nUrl: string;
  dictJson?: string;
  includes?: Array<string | RegExp> | string | RegExp;
  exclude?: Array<string | RegExp> | string | RegExp;
  ignoreMark?: string;
  ignorePrefix?: RegExp;
  ignoreSuffix?: RegExp;
  skipCallExpression?: Array<RegExp> | RegExp;
  raw?: boolean;
  output?: boolean | string;
  transforms?: (Transfrom | string)[];
  jsx?: boolean;
}

export type Visitor = Parameters<typeof walk>[1];

export type Dict = Record<string, string>;

// 节点处理成功回调
export type CompilerSuccess<T> = (data: { name: string; data: T }) => any;

// 插件实体对象
export interface TransfromInstance {
  visitor: Visitor;
  callback?: (result: any[]) => any;
}

// 创建节点访问者方法
export type TransfromCreate = (data: {
  id: string; // 文件id
  options: Options; // 插件选项
  magicString: MagicString; // magicString实例
  dictData: Dict | null; // 国际化字典数据
  success: CompilerSuccess<any>; // 成功调用
  pluginContext: any; // transform上下文
}) => TransfromInstance;

// 插件信息
export type Transfrom = {
  name: string; // 插件名
  create: TransfromCreate; // 创建节点访问者方法
};
