/**
 * plugin.js
 *
 * rollup-plugin-external-bundle
 */

const fs = require("fs");
const path = require("path");
const xpath = path.posix;
const { format, promisify } = require("util");

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

  "php": {
    type: "php",
    fileName: "manifest.php",
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

    let context = "";
    if (typeof importer === "string") {
      context = path.dirname(importer);
    }

    const packageInfo = await this.getPackageInfo(source,context);
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
      // Normalize the source string if it is a relative path.
      let id;
      if (source[0] == "." && context) {
        id = xpath.resolve(context,source);
      }
      else {
        id = source;
      }

      // Remember root directory relative to project tree for later.
      bundleInfo.packageRoot = packageRoot.replace(/\\/g,"/");

      this.bundles.set(id,bundleInfo);

      return BUNDLE_PREFIX + id;
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

  async getPackageInfo(source,context) {
    const readFile = promisify(fs.readFile);
    const candidates = [];

    // Resolve relative source paths against the context (i.e. parent
    // directory).
    if (source[0] == "." && context) {
      candidates.push(path.resolve(path.join(context,source)));
    }
    else {
      // Otherwise resolve against the node_modules directory.
      candidates.push(path.join(this.nodeModulesPath,source));
    }

    for (const packageRoot of candidates) {
      if (this.packageJson.has(packageRoot)) {
        return this.packageJson.get(packageRoot);
      }

      const packagePath = path.join(packageRoot,"package.json");

      try {
        const data = await readFile(packagePath);

        try {
          const entry = {
            packageRoot,
            packageJson: JSON.parse(data)
          };

          this.packageJson.set(packageRoot,entry);

          return entry;

        } catch (err) {
          console.warn("Failed to parse JSON in '%s'",packagePath);
        }

      } catch (ex) {
        // File not found.
        continue;
      }
    }

    return null;
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
          root = xpath.relative('.',bundleInfo.packageRoot);
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
