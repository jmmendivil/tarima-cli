var $ = require('./utils');

var path = require('path'),
    clc = require('cli-color'),
    micromatch = require('micromatch'),
    Promise = require('es6-promise').Promise;

var logger = require('./logger');

// TODO: install strategy

var tarima;

module.exports = function(files, deps, cb) {
  tarima = tarima || require('tarima');

  var tasks = [],
      options = this.opts,
      hasLogs = logger.isEnabled();

  var isReady = this.ready,
      isDebug = this.ready || logger.isDebug();

  var bundleOpts = {
    paths: $.toArray(options.modules)
  };

  function tarimaOpts() {
    var params = {};

    for (var key in options.compileOptions) {
      params[key] = options.compileOptions[key];
    }

    return params;
  }

  // custom events
  var onWrite = this.emit.bind(null, 'write'),
      onDelete = this.emit.bind(null, 'delete');

  function ensurePromise(task) {
    return new Promise(function(resolve, reject) {
      task(function(err, result) {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
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
      // next(options.compileOptions.compileDebug ? err : null);
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
    var entry = deps[id];

    if (!entry) {
      return;
    }

    entry.mtime = $.mtime(id);

    delete entry.dirty;

    if (resolve) {
      resolve(entry);
    }
  }

  function copy(id) {
    var start = new Date();

    var target = {
      src: id,
      dest: dest(id)
    };

    var err;

    try {
      sync(id);
      ensureRename(target);

      $.copy(target.src, target.dest);

      deps[id].dest = target.dest;

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
  }

  function track(id, sub) {
    sync(id);

    (sub || []).forEach(function(filepath) {
      sync(filepath, function(entry) {
        if (!entry.deps) {
          entry.deps = [];
        }

        if (entry.deps.indexOf(id) === -1) {
          entry.deps.push(id);
        }
      });
    });
  }

  function append(src, next) {
    var entry = deps[src];

    if (!entry) {
      entry = deps[src] = {};
    } else if (!$.isFile(src)) {
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
    if (!deps[src]) {
      return;
    }

    if (deps[src].deleted) {
      // TODO: do anything else?
      logger.printf('\r{diff.yellow|%s}', path.relative(options.cwd, deps[src].dest));
      logger.printf(clc.erase.lineRight);
      logger.writeln();

      onDelete(src, deps[src]);
    } else if (!tarima.support.isSupported(src)) {
      // TODO: support for extra tasks?
      copy(src);
    } else {
      try {
        var partial = tarima.load(src, tarimaOpts());
      } catch (e) {
        return cb(e);
      }

      tasks.push(function(next) {
        var begin;

        if (isDebug) {
          begin = new Date();
        }

        if (hasLogs && (begin || !isDebug)) {
          logger.printf('\r{pending.yellow|%s ...}', rel(src));
          logger.printf(clc.erase.lineRight);
        }

        tarima.bundle(partial, bundleOpts).render(function(err, output) {
          var end;

          if (begin) {
            end = $.timeDiff(begin);
          }

          if (err) {
            if (hasLogs) {
              logger.printf('\r{err.red|%s} {blackBright|%s}', rel(src), end);
              logger.printf(clc.erase.lineRight);
              logger.writeln();
            }

            return cb(err);
          }

          var file = output.filename,
              target = dest(file, output.extension);

          deps[file].dest = target;

          var index = track.bind(null, file);

          var result = {
            src: file,
            dest: target,
            output: output.source
          };

          index(output.dependencies.filter(function(id) {
            if (id.indexOf(options.src) !== 0) {
              return;
            }

            if (!deps[id]) {
              deps[id] = {};
            }

            return deps[id];
          }));

          ensureWrite(result, index);

          // update
          if (begin) {
            end = $.timeDiff(begin);
          }

          if (hasLogs && end) {
            logger.printf('\r{ok.green|%s} {blackBright|%s}\n', rel(result.dest), end);
          }

          if (!isDebug && hasLogs) {
            logger.printf('\r{ok.green|%s}', rel(result.dest));
            logger.printf(clc.erase.lineRight);
          }

          delete result.output;

          next(undefined, result);
        });
      });
    }
  }

  var match = micromatch.filter(['**'].concat(options.filter || []), { dot: true }),
      start = +new Date(),
      seen = {};

  files.forEach(function(src) {
    var file = path.join(options.src, src);

    if (!seen[file] && match(src)) {
      seen[file] = true;
      append(file, process);
    }

    if (deps[file] && deps[file].deps && isReady) {
      deps[file].deps.forEach(function(parent) {
        if (!seen[parent] && match(path.relative(options.src, parent))) {
          seen[parent] = true;
          process(parent);
        }
      });
    }
  });

  if (!isDebug) {
    Promise.all(tasks.map(ensurePromise))
      .then(function(data) {
        var end = $.timeDiff(start);

        if (hasLogs && files.length) {
          logger.printf(' {blackBright|%s}\n', end);
        }

        cb(undefined, {
          elapsed: end,
          stats: data,
          deps: deps
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
        elapsed: $.timeDiff(start),
        stats: data,
        deps: deps
      });
    }).catch(onError);
  }
};
