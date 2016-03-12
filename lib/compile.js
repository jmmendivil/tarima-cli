var $ = require('./utils');

var path = require('path');

var logger = require('./logger');

var tarima;

module.exports = function(result, done) {
  tarima = tarima || require('tarima');

  var options = this.opts;

  // custom events
  var onWrite = this.emit.bind(null, 'write'),
      onDelete = this.emit.bind(null, 'delete');

  // stats
  result.ok = [];
  result.err = [];

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

  function tarimaOpts() {
    var params = {};

    for (var key in options.compileOptions) {
      params[key] = options.compileOptions[key];
    }

    return params;
  }

  var _ = $.chain(function(err, next) {
    if (process.env.CI) {
      done(err);
    } else {
      next(options.compileOptions.compileDebug ? err : null);
    }
  });

  function log(id, cb) {
    return function(next) {
      var a = path.relative(options.cwd, id);

      logger.PENDING(a);

      var start = new Date();

      cb(function(err) {
        if (!err) {
          var b = path.relative(options.cwd, result.dependencies[id].dest);

          logger.SUCCESS(b + ' in ' + $.timeDiff(start));
          result.ok.push(id);
        } else {
          logger.FAILURE(a);
          result.err.push(id);
        }

        logger.write('\n');

        next(err);
      });
    };
  }

  function dest(id, ext) {
    var fixedId = path.relative(options.src, id);

    return path.join(options.dest, ext ? fixedId.replace(/\.[\w.]+$/, '.' + ext) : fixedId);
  }

  function sync(id, resolve) {
    var entry = result.dependencies[id];

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
    return function(next) {
      var target = {
        src: id,
        dest: dest(id)
      };

      var err,
          start = new Date();

      var b = path.relative(options.cwd, target.dest);

      try {
        sync(id);
        ensureRename(target);

        $.copy(target.src, target.dest);

        result.dependencies[id].dest = target.dest;

        logger.SUCCESS(b + ' in ' + $.timeDiff(start) + '\n');
        result.ok.push(id);
      } catch (e) {
        err = e;

        result.err.push(id);
        logger.FAILURE(b + '\n');
      }

      next(err);
    };
  }

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

  function compile(partial, next) {
    var bundleOpts = {
      paths: $.toArray(options.modules)
    };

    tarima.bundle(partial, bundleOpts).render(function(err, output) {
      if (err) {
        return next(err);
      }

      var file = output.filename,
          target = dest(file, output.extension);

      result.dependencies[file].dest = target;

      if (!err) {
        target = {
          src: file,
          dest: target,
          output: output.source,
          locals: output.locals
        };

        var index = track.bind(null, target.src);

        index(output.dependencies.filter(function(id) {
          return result.dependencies[id];
        }));

        ensureWrite(target, index);
      }

      next(err);
    });
  }

  result.files.forEach(function(src) {
    if (result.dependencies[src].deleted) {
      // TODO: do anything else?
      logger.WARN(path.relative(options.cwd, src) + '\n');
      onDelete(src, result.dependencies[src]);
    } else if (!tarima.support.isSupported(src)) {
      // TODO: support for extra tasks?
      _.then(copy(src));
    } else {
      _.then(log(src, function(next) {
        compile(tarima.load(src, tarimaOpts()), next);
      }));
    }
  });

  _.run(done);
};
