/**
 * Empty module for webpack resolve.fallback when bundling for browser.
 * Node's "fs" is not available in browser; libraries like strtok3 may require it.
 */
module.exports = {};
