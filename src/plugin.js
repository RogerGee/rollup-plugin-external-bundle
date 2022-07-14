/**
 * plugin.js
 *
 * rollup-plugin-package-bundle
 */

const fs = require("fs");
const path = require("path");
const { format } = require("util");

const BUNDLE_PREFIX = "\0bundle:";
const BUNDLE_EXTERN_PREFIX = "\0extern-bundle:";

class Plugin {
  constructor(_options) {
    const options = _options || {};

    this.nodeModulesPath = options.nodeModulesPath || "node_modules";
    this.packageJson = new Map();
    this.bundles = new Map();
    this.globals = {};
  }

  async resolveId(source,importer,options) {
    // Resolve external bundle modules.
    if (source.startsWith(BUNDLE_EXTERN_PREFIX)) {
      return {
        id: source,
        external: true
      };
    }

    if (this.bundles.has(source)) {
      return BUNDLE_PREFIX + source;
    }

    const packageJson = await this.getPackageInfo(source);
    if (!packageJson) {
      return null;
    }

    // Use non-standard 'bundles' (or 'bundle') property to pull
    // information.
    const bundleInfo = packageJson.bundles || packageJson.bundle;
    if (!bundleInfo || typeof bundleInfo !== "object" || Array.isArray(bundleInfo)) {
      return null;
    }

    // If the bundle is valid (i.e. contains refs), then we add it to the
    // ordered map of bundles. This preserves the import order.
    if (bundleInfo.refs && Array.isArray(bundleInfo.refs)) {
      // Remember root directory relative to project tree for later.
      bundleInfo.root = path.join(this.nodeModulesPath,source).replace(/\\/g,"/");

      this.bundles.set(source,bundleInfo);

      return BUNDLE_PREFIX + source;
    }

    return null;
  }

  async load(id) {
    if (id.startsWith(BUNDLE_PREFIX)) {
      const moduleId = id.slice(BUNDLE_PREFIX.length);
      return this.loadBundle(moduleId);
    }

    return null;
  }

  loadBundle(id) {
    const bundleInfo = this.bundles.get(id);
    if (!bundleInfo || bundleInfo.refs.length == 0) {
      return null;
    }

    // Make external bundle module ID.
    const bundleId = BUNDLE_EXTERN_PREFIX + id;

    // If a global was provided, load a virtual module that provides imports
    // and/or exports.
    if (bundleInfo.global && typeof bundleInfo.global === "string") {
      this.globals[bundleId] = bundleInfo.global;

      let code = "";
      if (bundleInfo.imports && Array.isArray(bundleInfo.imports)) {
        code += bundleInfo.imports.map((i) => format("import '%s';",i)).join("\n");
      }

      code += format("export { default } from \"%s\";\n",bundleId);
      if (bundleInfo.exports && Array.isArray(bundleInfo.exports)) {
        const inner = bundleInfo.exports.join(", ");
        code += format("export { %s } from \"%s\";\n",inner,bundleId);
      }

      return code;
    }

    // If no global was provided, then the bundle is a pure source import
    // that imports the virtual module.
    return format("import '%s';\n",bundleId);
  }

  async getPackageInfo(source) {
    if (this.packageJson.has(source)) {
      return this.packageJson.get(source);
    }

    const packagePath = path.join(this.nodeModulesPath,source,"package.json");
    return new Promise((resolve,reject) => {
      fs.readFile(packagePath,(err,data) => {
        if (err) {
          resolve(null);
        }
        else {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            console.warn("Failed to parse JSON in '%s'",packagePath);
          }
        }
      });
    });
  }

  getGlobals() {
    return this.globals;
  }
}

module.exports = {
  Plugin
};
