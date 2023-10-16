
import Vue from "vue";
import VueI18n from "vue-i18n";
// import json from "./dict.json"

Vue.use(VueI18n);

export const i18n = new VueI18n({
  locale: "EN",
  messages: {
    'EN': {
      '123': 'China',
      '123{0}': "China{0}"
    },
    'ZH_CN': {
      '123': '中国',
      '123{0}': "中国{0}"
    }
  }
});

export function i18nHelper(key, args, _str) {
  // const code = json[key]
  // const value = code ? i18n.t(code, args) : key;
  return i18n.t(key, args);
}
