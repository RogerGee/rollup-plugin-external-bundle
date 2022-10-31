/**
 * error.js
 *
 * rollup-plugin-external-bundle
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
