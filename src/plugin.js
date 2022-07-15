/**
 * plugin.js
 *
 * rollup-plugin-package-bundle
 */

const fs = require("fs");
const path = require("path");
const xpath = path.posix;
const { format } = require("util");

const clone = require("clone");

const { createManifest } = require("./manifest");

const BUNDLE_PREFIX = "\0bundle:";
const BUNDLE_EXTERN_PREFIX = "\0extern-bundle:";

const DEFAULT_MANIFEST_OPTIONS = {
  "json": {
    type: "json",
    fileName: "manifest.json",
    sections: {
      scripts: "\\.js$",
      styles: "\\.css$"
    }
  },

  "html": {
    type: "html",
    template: false, // must be included by user
    fileName: "manifest.html",
    sections: {
      scripts: "\\.js$",
      styles: "\\.css$"
    }
  }
};

class Plugin {
  constructor(_options) {
    const options = _options || {};

    this.buildType = options.buildType || "local";
    this.nodeModulesPath = options.nodeModulesPath || "node_modules";
    if (typeof options.manifestOptions === "undefined") {
      this.manifestOptions = clone(DEFAULT_MANIFEST_OPTIONS["json"]);
    }
    else {
      const { type } = options.manifestOptions;
      const manifestOptions = Object.assign(
        {},
        DEFAULT_MANIFEST_OPTIONS[type],
        options.manifestOptions
      );

      this.manifestOptions = clone(manifestOptions);
    }
    this.prependRefs = options.prependRefs || [];
    this.appendRefs = options.appendRefs || [];
    this.disableOutputRefs = options.disableOutputRefs || false;

    this.packageJson = new Map();
    this.bundles = new Map();
    this.importOrder = [];
    this.globals = {};
    this.refs = [];
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

    const packageInfo = await this.getPackageInfo(source);
    if (!packageInfo) {
      return null;
    }

    const { packageRoot, packageJson } = packageInfo;

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
      bundleInfo.packageRoot = packageRoot.replace(/\\/g,"/");

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

    const packageRoot = path.join(this.nodeModulesPath,source);
    const packagePath = path.join(packageRoot,"package.json");
    return new Promise((resolve,reject) => {
      fs.readFile(packagePath,(err,data) => {
        if (err) {
          resolve(null);
        }
        else {
          try {
            resolve({ packageRoot, packageJson: JSON.parse(data) });
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

  captureImport(id) {
    if (id.startsWith(BUNDLE_EXTERN_PREFIX)) {
      this.importOrder.push(id.slice(BUNDLE_EXTERN_PREFIX.length));
    }
  }

  addRef(refInfo,root,prepend) {
    if (typeof refInfo === "string") {
      this.refs.push(refInfo);
    }
    else if (this.buildType in refInfo) {
      let ref = refInfo[this.buildType];

      if (root) {
        ref = xpath.join(root,ref);
      }

      if (prepend) {
        this.refs.unshift(ref);
      }
      else {
        this.refs.push(ref);
      }
    }
  }

  addBundleRefs() {
    for (const id of this.importOrder) {
      const bundleInfo = this.bundles.get(id);
      if (!bundleInfo) {
        continue;
      }

      // Append bundle references to list.
      for (const refInfo of bundleInfo.refs) {
        // Local refs need to be prefixed under the package root. This is so
        // that the asset under node_modules can be referenced.
        let root;
        if (this.buildType == "local") {
          root = bundleInfo.packageRoot;
        }

        this.addRef(refInfo,root);
      }
    }
  }

  addAdditionalRefs(options) {
    // Prepend additional references.
    for (const refInfo of this.prependRefs) {
      this.addRef(refInfo,null,true);
    }

    // Add additional references.
    for (const refInfo of this.appendRefs) {
      this.addRef(refInfo);
    }
  }

  addOutputRefs(options,bundle) {
    if (this.disableOutputRefs) {
      return;
    }

    for (const fileName in bundle) {
      let ref = fileName;
      if (options.dir) {
        ref = xpath.join(options.dir,ref);
      }
      this.addRef(ref);
    }
  }

  async createManifestFile() {
    if (!this.manifestOptions) {
      return;
    }

    const manifest = createManifest(this.refs,this.manifestOptions);
    if (manifest.isEmpty()) {
      return;
    }

    let fileName = this.manifestOptions.fileName;
    if (!fileName) {
      return;
    }

    const blob = await manifest.generate();

    return {
      type: "asset",
      fileName,
      source: blob
    };
  }

  reset() {
    this.refs = [];
  }
}

module.exports = {
  Plugin
};
