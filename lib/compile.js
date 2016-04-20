var $ = require('./utils');

var path = require('path'),
    // clc = require('cli-color'),
    micromatch = require('micromatch'),
    Promise = require('es6-promise').Promise;

var logger = require('./logger');

var tarima;

module.exports = function(files, cb) {
  tarima = tarima || require('tarima');

  var start = +new Date();

  var cache = this.cache;

  var tasks = [],
      options = this.opts,
      hasLogs = logger.isEnabled();

  var dispatch = this.dispatch;

  function tarimaOptions() {
    var params = {};

    for (var key in options.bundleOptions) {
      params[key] = options.bundleOptions[key];
    }

    return params;
  }

  // custom events
  var onWrite = this.emit.bind(null, 'write'),
      onDelete = this.emit.bind(null, 'delete');

  function ensurePromise(task) {
    return $.promisify(task)();
  }

  function ensureRename(view) {
    if (typeof options.rename === 'function') {
      options.rename(view);
    }
  }

  function ensureWrite(view, index) {
    onWrite(view, index);
    $.write(view.dest, view.output);
  }

  function onError(err) {
    if (process.env.CI) {
      cb(err);
    } else {
      console.log('WUT', err);
      // next(options.bundleOptions.compileDebug ? err : null);
    }
  }

  function rel(id) {
    return path.relative(options.cwd, id);
  }

  function dest(id, ext) {
    var fixedId = path.relative(options.src, id);

    return path.join(options.dest, ext ? fixedId.replace(/\.[\w.]+$/, '.' + ext) : fixedId);
  }

  function sync(id, resolve) {
    var entry = cache.get(id);

    entry.mtime = $.mtime(id);

    delete entry.dirty;

    if (resolve) {
      resolve(entry);
    }
  }

  function copy(files) {
    return function(next) {
      var out = [];

      files.forEach(function(id) {
        var target = {
          src: id,
          dest: dest(id)
        };

        ensureRename(target);

        var isDirty = !$.exists(target.dest) || ($.mtime(target.dest) < $.mtime(id));

        if (!isDirty && options.force !== true) {
          return;
        }

        sync(id);

        out.push(target.dest);

        console.log(id + ' copied');

        $.copy(target.src, target.dest);

        cache.set(id, 'dest', target.dest);
      });

      next(undefined, out);
    };
  }

  function track(src, sub) {
    sync(src);

    (sub || []).forEach(function(filepath) {
      sync(filepath, function(entry) {
        if (!entry.deps) {
          entry.deps = [];
        }

        if (entry.deps.indexOf(src) === -1) {
          entry.deps.push(src);
        }
      });
    });
  }

  function append(src, next) {
    var entry = cache.get(src);

    if (!$.isFile(src)) {
      entry.deleted = true;
    }

    entry.dirty = !entry.mtime || entry.dirty || entry.deleted
      || ($.mtime(src) > entry.mtime)
      || options.force;

    if (!entry.dirty) {
      delete entry.dirty;
    } else {
      next(src);
    }
  }

  function process(src) {
    var entry = cache.get(src);

    if (entry.deleted) {
      // TODO: do anything else?
      console.log('DELETE', entry.dest);
      onDelete(src, entry);
    } else {
      var opts = tarimaOptions();

      try {
        var partial = tarima.load(src, opts);
      } catch (e) {
        return cb(e);
      }

      tasks.push(function(next) {
        if (partial.params.data._bundle) {
          partial = tarima.bundle(partial, opts);
        }

        partial.render(function(err, output) {
          if (err) {
            return next(err, cb);
          }

          var file = output.filename,
              target = dest(file, output.extension);

          var index = track.bind(null, file);

          var result = {
            src: file,
            dest: target
          };

          ensureRename(result);

          result.output = output.source;

          index(output.deps.filter(function(id) {
            if (id.indexOf(options.src) !== 0) {
              return;
            }

            return cache.get(id);
          }));

          ensureWrite(result, index);

          cache.set(file, 'dest', target);

          delete result.output;

          console.log(src + ' compiled');

          next(undefined, target);
        });
      });
    }
  }

  var match = micromatch.filter(['**'].concat(options.filter || []), { dot: true }),
      seen = {};

  var unknown = [];

  files.forEach(function(src) {
    var file = path.join(options.src, src),
        entry = cache.get(file);

    if (!entry) {
      entry = {};
      cache.set(file, entry);
    }

    if (!tarima.support.isSupported(src)) {
      return append(file, function(file) {
        if (match(src)) {
          unknown.push(file);
        }
      });
    }

    if (!seen[file] && match(src)) {
      seen[file] = true;
      append(file, process);
    }

    if (entry.dirty && entry.deps) {
      entry.deps.forEach(function(parent) {
        if (!seen[parent] && match(path.relative(options.src, parent))) {
          seen[parent] = true;
          process(parent);
        }
      });
    }
  });

  if (unknown.length) {
    dispatch(unknown, function(files, run) {
      Array.prototype.unshift.apply(tasks, (files.length ? [copy(files)] : []).concat(run));
    });
  }

  Promise.all(tasks.map(ensurePromise))
    .then(function(data) {
      function flatten(x) {
        var y = [];
        x.forEach(function(set) {
          if (Array.isArray(set)) {
            Array.prototype.push.apply(y, flatten(set));
          } else {
            y.push(set);
          }
        });
        return y;
      }

      cb(undefined, {
        entries: flatten(data),
        elapsed: $.timeDiff(start)
      });
    })
    .catch(onError);
};
