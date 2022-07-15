/**
 * manifest/index.js
 *
 * rollup-plugin-package-bundle
 */

const { JsonManifest } = require("./json");
const { PluginError } = require("../error");

/**
 * Factory function for creating a manifest.
 */
function createManifest(refs,options) {
  const { type } = options;

  switch (type) {
    case "json":
      return new JsonManifest(refs,options);
  }

  throw new PluginError("Manifest type '%s' is invalid",type);
}

module.exports = {
  createManifest
};
