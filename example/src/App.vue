<script setup>
const fn = (val) => "(" + val + ")";
const name1 = "一二三"; // 普通字符串
const name2 = `一二三${name1}`; // 模板字符串
const name3 = `${`一二三${name1}`}一二三${fn(name1)}`; // 复杂模板字符串
const name4 = "三" + "2" +  "一二三"; // 表达式不参与 只针对字符串和模板字符串
const name5 = "i18n!:一二三"; // i18n!: 开头的内容不参与编译
const name6 = "    一二三   ";  // 首尾空格不参与编译 可设置ignorePrefix和ignoreSuffix自定义规则
const text = [name1, name2, name3, name4, name5, name6];
i18nHepler("一二三")
</script>

<template>
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
    <li v-for="(v, i) in text" :key="i">{{ v }}</li>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  color: red;
  will-change: filter;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
