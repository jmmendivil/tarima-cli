var $ = require('./utils');

var micromatch = require('micromatch'),
    Promise = require('es6-promise').Promise;

function promisify(callback) {
  return function(files) {
    return new Promise(function(resolve, reject) {
      if (callback.length === 2) {
        return callback(files, function(err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      }

      return Promise.resolve(callback(files)).catch(reject).then(resolve);
    });
  };
}

function dispatch(files, copy, end) {
  var cb = [];
  var src = [];
  var filters = this;

  files.forEach(function(file) {
    for (var k in filters) {
      if (filters[k].matches(file)) {
        if (!src[k]) {
          src[k] = [];
        }
        cb[k] = promisify(filters[k].finish);
        src[k].push(file);
      } else {
        copy(file);
      }
    }
  });

  var promise = Promise.all(cb.map(function(task, k) {
    return task(src[k]);
  }));

  if (end) {
    return promise.catch(function(error) {
      end(error);
    })
    .then(function(result) {
      end(undefined, result);
    });
  }

  return promise;
}

function filter(expr, cb) {
  this.push({
    matches: micromatch.filter(!Array.isArray(expr) ? [expr] : expr, {
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

module.exports = function(options) {
  var hooks = {},
      filters = [];

  return {
    util: $,
    opts: options,
    on: on.bind(hooks),
    emit: emit.bind(hooks),
    filter: filter.bind(filters),
    dispatch: dispatch.bind(filters)
  };
};
