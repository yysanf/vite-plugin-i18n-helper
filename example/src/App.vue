<template>
 <div>
    <button @click="setLocale('ZH_CN')">中文</button>
    <button @click="setLocale('EN')">英文</button>
    <h6>文本测试</h6>
    <div><!--一二三--></div>
    一二三
    <div>一二三</div>
    <div><span><span><span><span><span>一二三</span></span></span></span></span></div>
    <div>{{"一二三"}}</div>
    <div><span>一二三 {{ 1 }} {{ true }}</span></div>
    <div><span>一二三 {{ name5 }} 一二三</span></div>
    <div><span :class="{ foo: true }">{{ name5 === "EN" ? "" : "一二三" }}</span></div>
    <h6>包含指令</h6>
    <div><div id="foo" v-foo>一二三</div></div>
    <div><div id="foo" v-foo title="一二三"></div></div>
    <div><div id="foo" v-foo title="一二三">{{"一二三"}}</div></div>
    <div><div id="foo" v-foo title="一二三">一二三</div></div>
    <h6>static props</h6>
    <div title="一二三" name="name5"></div>
    <h6>dynamic props</h6>
    <div title="一二三" :name="name5" :test="'一二三' + name5"></div>
    <div :[name5]="'一二三'" :name="name5" :test="'一二三' + name5"></div>
    <h6>props + children</h6>
    <div title="一二三" :name="name5">一二三</div>
    <h6>v-bind</h6>
    <div v-bind="$attrs" title="一二三" name="name5">一二三</div>
    <h6>v-bind after static prop</h6>
    <div title="一二三" name="name5" v-bind="$attrs">一二三</div>
    <h6>v-bind between static props</h6>
    <div name="name5" v-bind="$attrs" title="一二三" class="test" :class="name5">一二三</div>
    <template title="一二三" />
    <h6>for 循环</h6>
    <div><div v-for="i in list" :key="i" id="foo"><span>一二三</span></div></div>
    <div><div v-for="i in list" :key="i" id="foo"><span>{{"一二三"}}</span></div></div>
    <h6>if 判断</h6>
    <div><div v-if="name5 === 'EN'">一二三</div><p v-else>{{"一二三"}}</p></div>
    <h6>文本插值</h6>
    <div><span>{{"一二三"}}</span></div>
    <div><span>一二三 {{ 1 }} {{ true }}</span></div>
    <div><span>一二三 {{ name5 }} 一二三</span></div>
    <div><span :class="{ foo: true }">{{ name5 === "EN" ? "" : "一二三" }}</span></div>
    <h6>包含事件</h6>
    <div><div @click="foo">一二三</div></div>
    <div><div :class="{}" title="一二三" @click="foo">一二三</div></div>
    <h6>组件</h6>
    <div><Comp content="一二三"/></div>
    <div><Comp content="一二三" :name="name5" /></div>
    <div><Comp>一二三</Comp></div>
    <div><Comp :name="name5"><div><span><span><span><span><span>一二三</span></span></span></span></span></div></Comp></div>
    <div><Comp :name="name5"><template #default="name">一二三{{name}}</template></Comp></div>
    <h6>svg</h6>
    <div><svg title="一二三"><path d="M2,3H5.5L12"/></svg></div>
 </div>
</template>
<script>
export default {
  directives: {
    foo() {},
  },
}
</script>
<script setup>
import { useI18n } from "vue-i18n";
const { locale } = useI18n();

const setLocale = (val) => locale.value = val;

const fn = (val) => "(" + val + ")";
const name1 = "一二三"; // 普通字符串
const name2 = `一二三${name1}`; // 模板字符串
const name3 = `${`一二三${name1}`}一二三${fn(name1)}`; // 复杂模板字符串
const name4 = "三" + "2" +  "一二三"; // 表达式不参与 只针对字符串和模板字符串
const name5 = "i18n!:一二三"; // i18n!: 开头的内容不参与编译
const name6 = "    一二三   ";  // 首尾空格不参与编译 可设置ignorePrefix和ignoreSuffix自定义规则
const text = [name1, name2, name3, name4, name5, name6];
const foo = () => '66';
const list = [1, 2, 3];
function Comp(props, context){
  return context.slots?.default ? context.slots.default(props.name || '') : (props.content || "无内容")
}


</script>
<style scoped>
h6 {
  font-size: 18px;
  margin: 10px 0;
}
</style>
