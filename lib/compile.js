var $ = require('./utils');

var path = require('path'),
    micromatch = require('micromatch'),
    Promise = require('es6-promise').Promise;

var logger = require('./logger');

var tarima;

module.exports = function(files, cb) {
  tarima = tarima || require('tarima');

  var start = +new Date();

  var cache = this.cache;

  var tasks = [],
      options = this.opts;

  var dist = this.dist,
      dispatch = this.dispatch;

  options.bundleOptions.dirtyFiles = {};
  options.bundleOptions.rollup = options.bundleOptions.rollup || {};

  cache.each(function(dep, id) {
    if (dep.dirty) {
      options.bundleOptions.dirtyFiles[path.join(options.cwd, id)] = 1;
    }

    files.forEach(function(file) {
      var offset = dep.deps && dep.deps.indexOf(file);

      // remove previous references
      if (offset >= 0) {
        dep.deps.splice(offset, 1);
      }
    });
  });

  if ($.isFile(this.opts.rollupFile)) {
    $.merge(options.bundleOptions.rollup, require(path.resolve(this.opts.rollupFile)));
  }

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

  function dest(id, ext) {
    return path.relative(options.cwd, path.join(options.dest, ext ? id.replace(/\.[\w.]+$/, '.' + ext) : id));
  }

  function sync(id, resolve) {
    var entry = cache.get(id) || {};

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

        logger.status('copy', target, function() {
          sync(id);

          out.push(target.dest);

          $.copy(target.src, target.dest);

          cache.set(id, 'dest', target.dest);
        });
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
      || ($.mtime(src) > entry.mtime);

    if (!entry.dirty && options.force !== true) {
      delete entry.dirty;
    } else {
      next(src);
    }
  }

  function process(src) {
    var entry = cache.get(src);

    if (entry.deleted) {
      // TODO: do anything else?
      onDelete(src, entry);
      cache.rm(src);

      dist({
        type: 'delete',
        src: entry.src,
        dest: entry.dest
      });
    } else {
      var opts = tarimaOptions();

      try {
        var partial = tarima.load(path.join(options.cwd, src), opts);
      } catch (e) {
        return cb(e);
      }

      tasks.push(function(next) {
        if (partial.params.data._bundle) {
          partial = tarima.bundle(partial, opts);
        }

        partial.render(function(err, output) {
          if (err) {
            return cb(err);
          }

          var file = path.relative(options.cwd, output.filename),
              target = dest(file, output.extension);

          var index = track.bind(null, file);

          var result = {
            src: file,
            dest: target
          };

          ensureRename(result);

          logger.status('compile', result, function() {
            result.output = output.source;

            var fixedDeps = [];

            output.deps.forEach(function(id) {
              if (id.indexOf(options.cwd) !== 0) {
                return;
              }

              fixedDeps.push(path.relative(options.cwd, id));
            });

            index(fixedDeps);
            ensureWrite(result, index);
            cache.set(file, 'dest', target);

            delete result.output;
          });

          next(undefined, target);
        });
      });
    }
  }

  var match = micromatch.filter(['**'].concat(options.filter || []), { dot: true }),
      seen = {};

  var unknown = [];

  files.forEach(function(src) {
    var entry = cache.get(src);

    if (!entry) {
      entry = {};
      cache.set(src, entry);
    }

    if (!tarima.support.isSupported(src)) {
      return append(src, function(id) {
        if (match(src)) {
          seen[id] = 1;
          unknown.push(id);
        }
      });
    }

    if (!entry.dirty && options.force !== true) {
      return;
    }

    if (!seen[src] && match(src)) {
      seen[src] = true;
      append(src, process);
    }

    if (entry.deps) {
      entry.deps.forEach(function(parent) {
        if (!seen[parent] && match(parent)) {
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
      cb(undefined, {
        cache: cache.all(),
        input: Object.keys(seen),
        output: $.flatten(data),
        elapsed: $.timeDiff(start)
      });
    })
    .catch(function(e) {
      cb(e);
    });
};
