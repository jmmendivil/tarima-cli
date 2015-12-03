var fs = require('fs-extra'),
    path = require('path'),
    tarima = require('tarima'),
    webpack = require('webpack'),
    AsyncParts = require('async-parts');

module.exports = function compileFiles(options, result, cb) {
  var chain = new AsyncParts(),
      bases = [];

  function sync(id, resolve) {
    var entry = result.dependencies[id];

    if (!entry) {
      return;
    }

    entry.mtime = +fs.statSync(entry.dest || id).mtime;

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

  function bundle(entry) {
    return function(next) {
      if (entry.bundle.indexOf('.js') > -1) {
        webpack({
          entry: entry.dest,
          resolve: {
            extensions: ['', '.js'],
            modulesDirectories: ['node_modules']
          },
          output: {
            path: options.dest,
            filename: path.relative(options.dest, entry.bundle)
          }
        }, function(err, stats) {
          var data = stats.toJson();

          if (data.errors.length || data.warnings.length) {
            return next([err].concat(data.errors, data.warnings).join('\n'));
          }

          var deps = data.modules.map(function(chunk) {
            return result.dependencies[chunk.identifier].src;
          });

          var id = deps.shift();

          if (id) {
            track(id, deps);
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
      var partial = tarima.load(file, options);

      var data = partial.params.options.data || {},
          view = partial.data(data);

      var name = file.replace(/\..+?$/, '.' + partial.params.ext),
          dest = path.join(options.dest, path.relative(options.src, name));

      if (options.bundle && match(file)) {
        result.dependencies[file].bundle = match(dest);
      }

      fs.outputFileSync(dest, view.source);

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
    if (options.bundle && (bases.indexOf(src) === -1) && match(src)) {
      bases.push(src);
    }

    chain.then(append(src));
  });

  chain.then(function(next) {
    bases.forEach(function(src) {
      var entry = result.dependencies[src];

      if (entry.bundle) {
        chain.then(bundle(entry));
      }
    });

    next();
  });

  chain.run(cb);
};
