var $ = require('./utils');

var Promise = require('es6-promise').Promise;

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
    matches: $.makeFilter($.toArray(expr)),
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

function dist(obj) {
  this.status(obj, function() {
    switch (obj.type) {
      case 'concat':
        $.write(obj.dest, obj.src.map(function(file) {
          return $.read(file);
        }).join('\n'));
      break;

      case 'delete':
        if (!$.isFile(obj.src) && $.isFile(obj.dest)) {
          $.unlink(obj.dest);
        }
      break;

      case 'unlink':
        if ($.isFile(obj.dest)) {
          $.unlink(obj.dest);
        }
      break;

      case 'write':
        $.write(obj.dest, obj.data);
      break;

      case 'copy':
        $.copy(obj.src, obj.dest);
      break;
    }
  });
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
    dist: dist.bind(logger),
    filter: filter.bind(filters),
    dispatch: dispatch.bind(filters)
  };
};
