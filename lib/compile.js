var $ = require('./utils');

var path = require('path'),
    clc = require('cli-color'),
    micromatch = require('micromatch'),
    Promise = require('es6-promise').Promise;

var logger = require('./logger');

var tarima;

module.exports = function(files, cb) {
  tarima = tarima || require('tarima');

  var cache = this.cache;

  var tasks = [],
      changed = [],
      options = this.opts,
      hasLogs = logger.isEnabled();

  var dispatch = this.dispatch;

  var isReady = this.ready,
      isDebug = this.ready() || logger.isDebug();

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
    ensureRename(view);
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

  function copy(id) {
    return function(next) {
      var start = new Date();

      var target = {
        src: id,
        dest: dest(id)
      };

      var isDirty = !$.exists(target.dest) || ($.mtime(target.dest) < $.mtime(id));

      if (!isDirty && options.force !== true) {
        return;
      }

      var err;

      try {
        sync(id);
        ensureRename(target);

        $.copy(target.src, target.dest);

        cache.set(id, 'dest', target.dest);

        logger.printf('\r{ok.green|%s} {blackBright|%s}', rel(target.dest), $.timeDiff(start));
      } catch (e) {
        logger.printf('\r{err.red|%s}', rel(target.dest));
        err = e;
      }

      logger.printf(clc.erase.lineRight);

      if (isDebug) {
        logger.writeln();
      }

      if (err) {
        cb(err);
      }

      changed.push(target);

      next();
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
      logger.printf('\r{diff.yellow|%s}', path.relative(options.cwd, entry.dest));
      logger.printf(clc.erase.lineRight);
      logger.writeln();

      onDelete(src, entry);
    } else {
      var opts = tarimaOptions();

      try {
        var partial = tarima.load(src, opts);
      } catch (e) {
        return cb(e);
      }

      tasks.push(function(next) {
        logger.status(rel(src), isDebug, function(done) {
          if (partial.params.data._bundle) {
            partial = tarima.bundle(partial, opts);
          }

          partial.render(function(err, output) {
            if (err) {
              return done(err, cb);
            }

            var file = output.filename,
                target = dest(file, output.extension);

            cache.set(file, 'dest', target);

            var index = track.bind(null, file);

            var result = {
              src: file,
              dest: target,
              output: output.source
            };

            index(output.deps.filter(function(id) {
              if (id.indexOf(options.src) !== 0) {
                return;
              }

              return cache.get(id);
            }));

            ensureWrite(result, index);

            changed.push({ src: file, dest: target });

            delete result.output;

            done(undefined, function(err1) {
              next(err1, result);
            }, rel(result.dest));
          });
        });
      });
    }
  }

  var match = micromatch.filter(['**'].concat(options.filter || []), { dot: true }),
      start = +new Date(),
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

    if (entry.deps && isReady()) {
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
      Array.prototype.unshift.apply(tasks, files.map(function(file) {
        return copy(file);
      }).concat(run));
    });
  }

  if (!isDebug) {
    Promise.all(tasks.map(ensurePromise))
      .then(function(data) {
        var end = $.timeDiff(start);

        if (hasLogs && changed.length) {
          logger.printf('{info.blackBright|%s file%s in %s}\n',
            changed.length,
            changed.length !== 1 ? 's' : '',
            end);
        }

        cb(undefined, {
          changedFiles: changed,
          sourceFiles: data,
          elapsed: end
        });
      })
      .catch(onError);
  } else {
    var promise = tasks.reduce(function(acc, task) {
      return acc.then(function(res) {
        return ensurePromise(task).then(function(result) {
          res.push(result);
          return res;
        });
      });
    }, Promise.resolve([]));

    promise.then(function(data) {
      cb(undefined, {
        changedFiles: changed,
        sourceFiles: data,
        elapsed: $.timeDiff(start)
      });
    }).catch(onError);
  }
};
