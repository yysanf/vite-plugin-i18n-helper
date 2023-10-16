import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import typescript from "rollup-plugin-typescript2";
import path from "node:path";
import i18nHelperPlugin from "vite-plugin-i18n-helper";

export default defineConfig({
  plugins: [
    typescript({ tsconfig: "../tsconfig.json" }),
    vue(),
    i18nHelperPlugin.vite({
      includes: ["src/**"],
      exclude: ["node_modules/*", "src/i18n.js"],
      customI18n: "i18nHelper",
      customI18nUrl: "/src/i18n",
      dictJson: path.resolve(__dirname, "./src/dict.json"),
      ignoreMark: "i18n!:",
      raw: true,
      output: false,
      transforms: ["V3Template"],
    }),
  ],
});
