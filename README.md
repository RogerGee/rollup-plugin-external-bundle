# `rollup-plugin-external-bundle`

This project provides a [Rollup](https://rollupjs.org/guide/en/) plugin that generates manifest files referencing external bundles. An external bundle is a block of code that would have been injected into the output bundle but is instead referenced via the manifest.

## Features

- Supports _local_ and _remote_ builds:
	- A local build is for local testing and uses a local external bundle (i.e. included via a dependency package)
	- A remote build is for production and uses a remote external bundle
- Generates manifests in the following formats: HTML, JSON

## Installation

~~~bash
npm install --save-dev rollup-plugin-external-bundle
~~~

## Usage

This plugin employs a special property in a dependency package's `package.json` file called `bundles` to obtain references to external builds of the bundle. These references can be local to the package or remote (e.g. an asset on a CDN).

The `bundles` property has a structure as demonstrated in the below example:

**Example dependency package: `node_modules/my-framework/package.json`**
~~~json
{
  /* ... */
  "bundles": {
	"refs": [
	  {
	    "local": "dist/my-framework.js",
	    "remote": "https://cdn.example.com/my-framework.min.js"
	  },
	  {
	    "local": "dist/my-framework.css",
	    "remote": "https://cdn.example.com/my-framework.min.css"
	  }
	],
	"global": "myFramework",
	"exports": [
	  "createApp"
	]
  }
}
~~~

The `bundles.refs` property is a list of bundle references to inject. Each list item is an object having `local` and `remote` properties denoting the reference string to use for local and remote builds respectively.

The `bundles.global` property names the global variable assigned the bundle's exports, and the `bundles.exports` property lists the export names. You can leave `bundles.exports` empty if there are no exports.

This plugin is utilized like any other Rollup plugin:

~~~javascript
import externalBundle from "rollup-plugin-external-bundle";

export default {
  input: "input.js",
  output: {
	file: "output.js",
	// ...
  },
  plugins: [
	externalBundle({
	  // Options go here...
	})
  ]
}
~~~

### Options

#### `buildType`
String; Either `local` or `remote`

Denotes the build type and determines which external bundle is referenced.

#### `nodeModulesPath`
String; defaults to `node_modules`

Denotes the path to where node modules are installed.

#### `manifestOptions`
Object; defaults to a `json`-type manifest

Configures the manifest options. Generic properties include:
- `type`: The type of manifest to generate
	- `json`: Generates a JSON file
	- `php`: Generates a PHP manifest file
	- `html`: Generates an HTML file from a template; the template uses [markup-js](https://www.npmjs.com/package/markup-js) to format reference names
- `fileName`: The name of the manifest output file
- `sections`: Object where the keys define the section names and the values are regular expressions that match references to assign to the sections

If `type` is `html`, the following options are available:
- `template`: The file name of the template file used in generating the HTML manifest

#### `prependRefs`, `appendRefs`
Array of string

Provide additional references to inject into the manifest. The `prependRefs` property adds refs to the beginning of the ref list. The `appendRefs` property adds refs to the end of the ref list.

#### `disableOutputRefs`
Boolean: default `false`

Disables injecting output bundle references into the manifest. By default, the plugin will inject the output bundle references into the manifest; this option disables that behavior.
