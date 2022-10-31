/**
 * main.js
 *
 * rollup-plugin-external-bundle
 */

const { Plugin } = require("./plugin.js");

function externalBundle(options) {
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
      // Augment globals with globals pulled from bundle imports.
      if (!options.globals) {
        options.globals = {};
      }
      Object.assign(options.globals,plugin.getGlobals());
    },

    async generateBundle(options,bundle) {
      // Capture imports for each chunk.
      for (const chunkName in bundle) {
        const chunk = bundle[chunkName];
        if (!chunk.imports) {
          continue;
        }

        for (let i = 0;i < chunk.imports.length;++i) {
          const id = chunk.imports[i];
          plugin.captureImport(id);
        }
      }

      // Generate manifest references. Currently, references are scoped to the
      // bundle, not an individual chunk.
      plugin.addBundleRefs();
      plugin.addAdditionalRefs(options);
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
  externalBundle,
  default: externalBundle
};
