/**
 * main.js
 *
 * rollup-plugin-package-bundle
 */

const { Plugin } = require("./plugin.js");

function packageBundle(options) {
  const plugin = new Plugin(options);

  return {
    name: "tccl-package-bundle",

    resolveId(source,importer,options) {
      return plugin.resolveId(source,importer,options);
    },

    load(id) {
      return plugin.load(id);
    },

    outputOptions(options) {
      if (!options.globals) {
        options.globals = {};
      }
      Object.assign(options.globals,plugin.getGlobals());
    }
  };
}

module.exports = {
  packageBundle,
  default: packageBundle
};
