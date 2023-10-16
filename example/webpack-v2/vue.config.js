const path = require("path");
const chalk = require("chalk");
const i18nHelperPlugin = require("vite-plugin-i18n-helper");
const ProgressBarPlugin = require("progress-bar-webpack-plugin");

let plugins = [
  new ProgressBarPlugin({
    format: " build [:bar] " + chalk.green.bold(":percent") + " (:elapsed seconds)",
    clear: false
  }),
  i18nHelperPlugin.webpackPlugin({
    includes: ["src/**"],
    exclude: ["node_modules/*", "src/i18n.js"],
    customI18n: "i18nHelper",
    customI18nUrl: "/src/i18n",
    dictJson: path.resolve(__dirname, './src/dict.json'),
    ignoreMark: "i18n!:",
    transforms: ['V2Template'],
    raw: true,
    output: true,
  })
];

module.exports = {
  publicPath: "./",
  runtimeCompiler: true,
  pluginOptions: {
    "style-resources-loader": {
      preProcessor: "less",
    }
  },
  css: {
    loaderOptions: {
      less: {
        modifyVars: {
          "primary-color": "#2563F4",
          "warning-color": "#FFC200",
          "success-color": "#58A268",
          "link-color": "#1890ff",
          "error-color": "#DE1919"
        },
        javascriptEnabled: true
      }
    }
  },
  chainWebpack: config => {
    const cacheHash = i18nHelperPlugin.createFileHash(path.resolve(__dirname, './src/dict.json'))
    config.module
      .rule("vue")
      .use("vue-loader")
      .tap(options => {
        options.cacheIdentifier = cacheHash + options.cacheIdentifier;
        return options;
      })
      .end();
    config.module
      .rule("js")
      .post()
      .end();
  },
  configureWebpack: {
    // cache: {
    //   buildDependencies: {
    //     // This makes all dependencies of this file - build dependencies
    //     config: [path.resolve(__dirname, './src/dict.json')],
    //     // 默认情况下 webpack 与 loader 是构建依赖。
    //   },
    // },
    plugins: [].concat(plugins),
    output: {
      filename: `js/[name].[hash:8].js`,
      chunkFilename: `js/[name].[hash:8].js`
    }
  },
  devServer: {
    host: "localhost",
    port: "8080",
    open: false,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
  },
  lintOnSave: false
};
