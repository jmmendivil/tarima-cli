module.exports = function() {
  this.opts.bundleOptions.locals = this.opts.bundleOptions.locals || {};
  this.opts.bundleOptions.locals.imageTag = require('./image-tag').call(this);
};
