/**
 * manifest/json.js
 *
 * rollup-plugin-package-bundle
 */

const { ManifestBase } = require("./base");

class JsonManifest extends ManifestBase {
  constructor(refs,options) {
    super("json",refs,options.sections);
  }

  async generate() {
    const blob = JSON.stringify(this.sections);

    return blob;
  }
}

module.exports = {
  JsonManifest
};
