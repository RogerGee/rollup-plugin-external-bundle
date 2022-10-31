/**
 * manifest/base.js
 *
 * rollup-plugin-external-bundle
 */

const { PluginError } = require("../error");

class ManifestBase {
  constructor(type,refs,sections) {
    this.type = type;
    this.refs = refs;
    this.sections = {};
    this._matchRefsBySection(refs,sections);
  }

  isEmpty() {
    return Object.keys(this.sections).length == 0;
  }

  async generate() {
    throw new PluginError("ManifestBase.generate() must be implemented");
  }

  _matchRefsBySection(refs,sections) {
    this.sections = {};
    for (const sectionName in sections) {
      const bucket = [];
      const regex = sections[sectionName];

      for (const ref of refs) {
        if (ref.match(regex)) {
          bucket.push(ref);
        }
      }

      this.sections[sectionName] = bucket;
    }
  }
}

module.exports = {
  ManifestBase
};
