
import { createI18n } from "vue-i18n";
const i18n = createI18n({
  legacy: false,
  locale: "ZH_CN",
  fallbackLocale: "ZH_CN",
  messages: {
    "ZH_CN": {
      "123": "ZH-一二三"
    },
    "EN": {
      "123": "EN-123"
    },
  },
});

export function i18nHelper(key, args, str) {
  try {
    const value = i18n.global.t(key, args);
    return value;
  } catch (error) {
    return str || key;
  }
}

export default i18n;