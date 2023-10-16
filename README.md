# vite-plugin-i18n-helper

## 简介
- 自动查找 包含中文 的字符串和模板字符串，并替换为自定义的国际化方法

## 安装

**node version:** >=16.0.0

**vite version:** >=3.0.0

```bash
npm i vite-plugin-i18n-helper -D
# or
yarn add vite-plugin-i18n-helper -D
# or
pnpm install vite-plugin-i18n-helper -D
```

## 使用

- vite.config.ts 中的配置插件

```ts
import i18nHelperPlugin from 'vite-plugin-i18n-helper'
import path from 'path'
export default () => {
  return {
    plugins: [
      i18nHelperPlugin.vite({
        includes: ["src/**"],
        exclude: ["node_modules/*", "src/i18n.js"],
        customI18n: "i18nHelper",
        customI18nUrl: "/src/i18n",
        dictJson: path.resolve(__dirname, "./src/dict.json"),
        raw: true,
        output: false,
        transforms: ["V3Template"], // vue3 模板编译优化导致部分内容非响应式 可以增加 V3Template 解决 
      }),
    ],
  }
}
```
## 示例
```ts
// 原始代码
const fn = (val) => "(" + val + ")";
const name1 = "一二三"; // 普通字符串
const name2 = `一二三${name1}`; // 模板字符串
const name3 = `${`一二三${name1}`}一二三${fn(name1)}`; // 复杂模板字符串
const name4 = "三" + "2" +  "一二三"; // 表达式不参与 只针对字符串和模板字符串
const name5 = "i18n!:一二三"; // i18n!: 开头的内容不参与编译
const name6 = "    一二三   ";  // 首尾空格不参与编译 可设置ignorePrefix和ignoreSuffix自定义规则
```
- 无 dictJson 参数时 会 转义所有包含中文的字符

```ts
// 处理后结果
import {i18nHelper} from "/src/i18n.js"
const fn = (val) => "(" + val + ")";
const name1 = i18nHelper("一二三");
const name2 = i18nHelper("一二三{0}",[name1]);
const name3 = i18nHelper("{0}一二三{1}",[i18nHelper("一二三{0}",[name1]),fn(name1)]);
const name4 = i18nHelper("三") + "2" +  i18nHelper("一二三");
const name5 = "一二三";
const name6 = `    ${i18nHelper("一二三")}   `;
```

- 有 dictJson 参数时 会 转义 dictJson 中匹配到的字符
```json
json 内容
{
  "一二三": "123",
  "一二三{0}": "123{0}",
  "{0}一二三{1}": "{0}123{1}"
}
```
```ts
// 处理后结果
import {i18nHelper} from "/src/i18n.js"
const fn = val => '(' + val + ')';
const name1 = i18nHelper("123",null,"一二三");
const name2 = i18nHelper("123{0}",[name1],"一二三{0}");
const name3 = i18nHelper("{0}123{1}",[i18nHelper("123{0}",[name1],"一二三{0}"),fn(name1)],"{0}一二三{1}");
const name4 = "三" + "2" +  i18nHelper("123",null,"一二三");
const name5 = "一二三";
const name6 = `    ${i18nHelper("123",null,"一二三")}   `; 
```

### 参数说明

| 参数 | 类型 | 默认值 | 必填 | 说明 |
| ---------   | --------- | --------- | --------- | --------- |
| customI18n    | `string` | - | 是 | 自定义 i18n 方法 |
| customI18nUrl | `string` | - | 是 | 自定义i8n 方法导入地址 |
| dictJson      | `string[]` | - | 否 | 匹配字典 |
| includes      | `Array<string\|RegExp>\|string\|RegExp`  |  -  | 否|  匹配文件规则 |
| exclude       | `Array<string\|RegExp>\|string\|RegExp`  |  -  | 否 | 忽略文件规则 |
| ignoreMark   | `string` | i18n!: | 否 | 忽略以该标识开头的内容 |
| ignorePrefix   | `RegExp` | `/^\s+/` | 否 | 忽略正则匹配的前缀内容 (默认首尾空格会忽略)|
| ignoreSuffix   | `RegExp` | `/\s+$/` | 否 | 忽略正则匹配的后缀内容 (默认首尾空格会忽略) |
| transforms   | `Array<string>` |  | 否 |  参见 内置 transfrom
| raw   | `boolean` | - | 否 | 是否保留 dictJson 匹配前的 原始值 (是 将作为customI18n 第三个参数传入) |
| output   | `boolean` | - | 否 | 是否输出字符串处理的结果  |


### 内置 transfrom
- V3Template (需执行于 .vue 文件被编译 之后)
  - vue3 template 模板的中文节点经过vue3的模板优化被标记为静态节，包含中文的静态节点转为国际化代码后，V3Template会将这些再编译成响应式节点
- V2Template (需执行于 .vue 文件被编译 之后)
  - vue2 包含中文的静态节点静态节点转为国际化代码后 V2Template会将这些再编译成响应式节点


### webpack
-  dictJson的内容更改后没有生效：具有缓存功能的loader(cache-loader, vue-loader)导致的，一般这些 loader 有缓存过期的配置项。例如 vue-cli 里的 vue-loader
``` js
// vue.config.js
chainWebpack: config => {
  // 将国际化字典内容生成hash
  const hash = i18nHelperPlugin.createFileHash(path.resolve(__dirname, './src/dict.json'));
  config.module
    .rule("vue")
    .use("vue-loader")
    .tap(options => {
      // 找到 vue-loader 的配置 并 设置 cacheIdentifier 加入国际化字典配置的hash
      options.cacheIdentifier += hash; 
      return options;
    });
}

// webpack5 的 buildDependencies 里面加入 配置
configureWebpack: {
  cache: {
    buildDependencies: {
      config: [path.resolve(__dirname, './src/dict.json')],
    },
  }
}
```

- babel处理早于插件导致 ES6 模板字符串编译失效
``` js
/** 例如在 vue-cli脚手架项目中 */
// 源码
const name = `${1}一二三${2}`;
//预期结果
const name = i18nHelper("{0}123{1}",[1,2],"{0}一二三{1}")
//实际结果
var name = "".concat(1, i18nHelper("123",null,"一二三"), 2);


// 因为 babel-loader 对ES6语法做了转义, 而插件执行顺序是在 babel后
// 所有需要将 babel 处理时机置后 改为enforce="post"

// vue.config.js
chainWebpack: config => {
    config.module
    .rule("js")
    .post()
    .end();
}
```

### 辅助功能
- 查看替换字符串 (vite)
  *  ip + 端口 + '/virtual:i18n-helper/result' (例如 http://127.0.0.1:5173/virtual:i18n-helper/result)
  * 绿色已完成替换   橙色 未完成
- 构建时输出替换结果
  * 设置 output:true  会输出  _i18n_helper_result.html 文件
  * 注意事项 webpack 开启了缓存(cache-loader等)时,命中缓存则无输出结果
