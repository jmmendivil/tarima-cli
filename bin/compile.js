var $ = require('./utils');

var path = require('path'),
    tarima = require('tarima'),
    webpack = require('webpack'),
    AsyncParts = require('async-parts');

module.exports = function compileFiles(options, result, cb) {
  var chain = new AsyncParts(),
      entries = [];

  chain.catch(function(err, next) {
    console.log($.style('{red|%s}', err.message || err));
    next();
  });

  function sync(id, resolve) {
    var entry = result.dependencies[id];

    if (!entry) {
      return;
    }

    entry.mtime = $.mtime(entry.dest || id);

    delete entry.dirty;

    if (resolve) {
      resolve(entry);
    }
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

  function match(filepath) {
    if (typeof options.bundle === 'function') {
      return options.bundle(filepath);
    }

    if (Array.isArray(options.bundle)) {
      var test = filepath.replace(options.bundle[0], options.bundle[1]);

      if (test !== filepath) {
        return test;
      }
    }
  }

  function bundle(file) {
    return function(next) {
      var entry = result.dependencies[file];

      if (entry.bundle && entry.bundle.indexOf('.js') > -1) {
        console.log('|--------------------');
        console.log('|', $.style('{yellow|%s}', path.relative(options.dest, entry.dest)));

        webpack({
          entry: entry.dest,
          resolve: {
            extensions: ['', '.js'],
            modulesDirectories: ['web/api', 'web_modules', 'node_modules']
          },
          output: {
            path: options.dest,
            filename: path.relative(options.dest, entry.bundle)
          }
        }, function(err, stats) {
          var data = stats.toJson();

          if (err || data.errors.length || data.warnings.length) {
            return next([err].concat(data.errors, data.warnings).join('\n'));
          }

          var deps = [];

          data.modules.forEach(function(chunk) {
            if (!result.dependencies[chunk.identifier]) {
              return;
            }

            deps.push(result.dependencies[chunk.identifier].src);
          });

          var src = deps.shift();

          if (src) {
            track(src, deps);
          }

          next(err);
        });
      } else {
        next();
      }
    };
  }

  function append(file) {
    return function(next) {
      console.log('|--------------------');
      console.log('|', $.style('{magenta|%s}', path.relative(options.src, file)));

      var partial = tarima.load(file, options.compileOptions || {});

      var data = partial.params.options.data || {},
          view = partial.data(data);

      var name = file.replace(/\..+?$/, '.' + partial.params.ext),
          dest = path.join(options.dest, path.relative(options.src, name));

      if (options.bundle && match(file)) {
        result.dependencies[file].bundle = match(dest);
      }

      $.write(dest, view.source);

      result.dependencies[file].dest = dest;

      if (!result.dependencies[dest]) {
        result.dependencies[dest] = {};
      }

      result.dependencies[dest].src = file;

      track(file, view.required);

      next();
    };
  }

  result.files.forEach(function(src) {
    if (options.bundle && (entries.indexOf(src) === -1) && match(src)) {
      entries.push(src);
    }

    chain.then(append(src));
  });

  chain.then(function(next) {
    entries.forEach(function(src) {
      chain.then(bundle(src));
    });

    next();
  });

  chain.run(cb);
};
