import { defineConfig } from "vite";
import { createVuePlugin } from "vite-plugin-vue2";
import i18nHelperPlugin from "vite-plugin-i18n-helper";
import path from "node:path";

export default defineConfig({
  plugins: [
    createVuePlugin(),
    i18nHelperPlugin.vite({
      includes: ["src/**"],
      exclude: ["node_modules/*", "src/i18n.js"],
      customI18n: "i18nHelper",
      customI18nUrl: "/src/i18n",
      dictJson: path.resolve(__dirname, './src/dict.json'),
      ignoreMark: "i18n!:",
      raw: true,
      output: true,
      transforms: ["V2Template"],
    }),
  ],
});
