/**
 * manifest/html.js
 *
 * rollup-plugin-package-bundle
 */

const mark = require("markup-js");
const readFile = require("util").promisify(require("fs").readFile);

const { ManifestBase } = require("./base");
const { PluginError } = require("../error");

class HtmlManifest extends ManifestBase {
  constructor(refs,options) {
    super("html",refs,options.sections);
    this.template = options.template;

    if (!this.template) {
      throw new PluginError("required option 'template' is missing");
    }
  }

  async generate() {
    const manifest = this.sections;
    const template = await readFile(this.template,{ encoding:"utf-8" });

    return mark.up(template,{ manifest });
  }
}

module.exports = {
  HtmlManifest
};
