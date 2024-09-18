
import Vue from "vue";
import VueI18n from "vue-i18n";

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

export function i18nHelper(key, args, str) {
  try {
    const value = i18n.t(key, args);
    return value;
  } catch (error) {
    return str || key;
  }
}
