var $ = require('./utils');

var path = require('path'),
    clc = require('cli-color'),
    micromatch = require('micromatch'),
    Promise = require('es6-promise').Promise;

var logger = require('./logger');
    // install = require('./install');

var tarima;

module.exports = function(files, deps, cb) {
  tarima = tarima || require('tarima');

  var tasks = [],
      options = this.opts,
      isDebug = logger.isDebug(),
      hasLogs = logger.isEnabled();

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

  // function copy(id) {
  //   return function(next) {
  //     return next() // TODO: REWRITE ASAP!!

  //     // TODO: quiet mode === fast copy!!

  //     var target = {
  //       src: id,
  //       dest: dest(id)
  //     };

  //     var err,
  //         start = new Date();

  //     var b = path.relative(options.cwd, target.dest);

  //     try {
  //       sync(id);
  //       ensureRename(target);

  //       $.copy(target.src, target.dest);

  //       deps[id].dest = target.dest;

  //       logger.printf('{ok.green|%s in %s}\n', b, $.timeDiff(start));
  //       // result.ok.push(id);
  //     } catch (e) {
  //       err = e;

  //       // result.err.push(id);
  //       logger.printf('{err.red|%s}\n', b);
  //     }

  //     next(err);
  //   };
  // }

  function track(id, deps) {
    sync(id);

    (deps || []).forEach(function(filepath) {
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

  function append(src, cb) {
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
      cb(src);
      // (entry.deps || []).forEach(function(id) {
      //   if (!deps[id].dirty) {
      //     deps[id].dirty = true;
      //     append(id, cb);
      //   }
      // });
    }
  }

  function process(src) {
    if (deps[src].deleted) {
      // TODO: do anything else?
      logger.printf('{diff.yellow|%s}\n', path.relative(options.cwd, deps[src].dest));
      onDelete(src, deps[src]);
    } else if (!tarima.support.isSupported(src)) {
      // TODO: support for extra tasks?
      // _.then(copy(src));
      console.log('COPY', src);
    } else {
      // partial.params.parts.forEach(function(ext) {
      //   var engine = tarima.support.resolve(ext);

      //   (engine && engine.requires || []).forEach(function(dep) {
      //     _.then(install(dep));
      //   });
      // });

      tasks.push(function(next) {
        var begin;

        if (isDebug) {
          begin = new Date();
        }

        if (hasLogs && (begin || !isDebug)) {
          logger.printf('\r{pending.yellow|%s ...}', rel(src));
          logger.printf(clc.erase.lineRight);
        }

        var partial = tarima.load(src, tarimaOpts());

        tarima.bundle(partial, bundleOpts).render(function(err, output) {
          var end;

          if (begin) {
            end = $.timeDiff(begin);
          }

          if (err) {
            if (!isDebug && hasLogs) {
              logger.printf('\r{err.red|%s}\n', rel(src));
            }

            if (hasLogs && end) {
              logger.printf('\r{err.red|%s} {blackBright|%s}\n', rel(src), end);
            }

            return next(err);
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

          if (output.deps) {
            index(output.deps.filter(function(id) {
              return deps[id];
            }));
          }

          ensureWrite(result, index);

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

  var match = micromatch.filter(['**'].concat(options.filtered || []), { dot: true });

  var start = +new Date();

  files.forEach(function(src) {
    if (match(src)) {
      append(path.join(options.src, src), process);
    }
  });

  if (!isDebug) {
    Promise.all(tasks.map(ensurePromise))
      .then(function(data) {
        var end = $.timeDiff(start);

        if (hasLogs) {
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
