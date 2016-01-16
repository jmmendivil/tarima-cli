var $ = require('./utils');

function emit(hook) {
  if (this[hook]) {
    var args = Array.prototype.slice.call(arguments, 1);

    this[hook].forEach(function(cb) {
      cb.apply(this, args);
    }, this);
  }
}

function on(hook, cb) {
  if (!this[hook]) {
    this[hook] = [];
  }

  this[hook].push(cb);
}

module.exports = function(options) {
  var hooks = {};

  return {
    util: $,
    opts: options,
    on: on.bind(hooks),
    emit: emit.bind(hooks)
  };
};