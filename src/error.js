/**
 * error.js
 *
 * rollup-plugin-package-bundle
 */

const { format } = require("util");

class PluginError extends Error {
  constructor(message,...args) {
    super(format(message,...args));
  }
}

module.exports = {
  PluginError
};
