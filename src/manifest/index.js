/**
 * manifest/index.js
 *
 * rollup-plugin-external-bundle
 */

const { JsonManifest } = require("./json");
const { PhpManifest } = require("./php");
const { HtmlManifest } = require("./html");
const { PluginError } = require("../error");

/**
 * Factory function for creating a manifest.
 */
function createManifest(refs,options) {
  const { type } = options;

  try {
    switch (type) {
      case "json":
        return new JsonManifest(refs,options);
      case "php":
        return new PhpManifest(refs,options);
      case "html":
        return new HtmlManifest(refs,options);
    }
  } catch (err) {
    if (err instanceof PluginError) {
      throw new PluginError("'manifestOptions' with type '%s': %s",type,err.message);
    }
    throw err;
  }

  throw new PluginError("Manifest type '%s' is invalid",type);
}

module.exports = {
  createManifest
};
