/**
 * main.js
 *
 * rollup-plugin-package-bundle
 */

const { Plugin } = require("./plugin.js");

function packageBundle(options) {
  const plugin = new Plugin(options);

  return {
    name: "package-bundle",

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
      plugin.addAdditionalRefs(options);
    },

    async generateBundle(options,bundle) {
      plugin.addOutputRefs(options,bundle);

      // Attempt manifest generation.
      const file = await plugin.createManifestFile();
      if (file) {
        this.emitFile(file);
      }

      // Reset plugin refs so that next bundle will not contain refs that it
      // does not reference.
      plugin.reset();
    }
  };
}

module.exports = {
  packageBundle,
  default: packageBundle
};
