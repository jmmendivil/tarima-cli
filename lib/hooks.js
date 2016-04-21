var $ = require('./utils');

var micromatch = require('micromatch'),
    Promise = require('es6-promise').Promise;

function dispatch(files, next) {
  var cb = [];
  var src = [];
  var unknown = [];
  var filters = this;

  files.forEach(function(file) {
    for (var k in filters) {
      if (filters[k].matches(file)) {
        if (!src[k]) {
          cb[k] = $.promisify(filters[k].finish);
          src[k] = [];
        }

        src[k].push(file);
        return;
      }
    }

    unknown.push(file);
  });

  next(unknown, function(done) {
    Promise.all(cb.map(function(task, k) {
      return task(src[k]);
    })).then(function(result) {
      done(undefined, result);
    });
  });
}

function filter(expr, cb) {
  this.push({
    matches: micromatch.filter($.toArray(expr), {
      dot: true
    }),
    finish: cb
  });
}

function emit(hook) {
  if (this[hook]) {
    var args = Array.prototype.slice.call(arguments, 1);

    this[hook].forEach(function(cb) {
      cb.apply(null, args);
    });
  }
}

function on(hook, cb) {
  if (!this[hook]) {
    this[hook] = [];
  }

  this[hook].push(cb);
}

module.exports = function(logger, options) {
  var hooks = {},
      filters = [];

  return {
    util: $,
    opts: options,
    logger: logger,
    on: on.bind(hooks),
    emit: emit.bind(hooks),
    filter: filter.bind(filters),
    dispatch: dispatch.bind(filters)
  };
};
