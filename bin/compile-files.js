var fs = require('fs-extra'),
    path = require('path'),
    tarima = require('tarima'),
    webpack = require('webpack'),
    anymatch = require('anymatch'),
    AsyncParts = require('async-parts');

module.exports = function compileFiles(options, result, cb) {
  var match = anymatch(options.bundle || []),
      chain = new AsyncParts(),
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

  function bundle(next) {
    var config = {
      entry: {},
      output: {
        path: options.dest,
        filename: '[name].js'
      }
    };

    bases.forEach(function(id) {
      var entry = result.dependencies[id],
          file = path.relative(options.dest, entry.dest);

      config.entry[file.replace(/(\w+)\/(?:index|\1)\.js$/, '$1')] = entry.dest;
    });

    webpack(config, function(err, stats) {
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
  }

  function append(file) {
    return function(next) {
      var partial = tarima.load(file, options);

      var data = partial.params.options.data || {},
          view = partial.data(data);

      var name = file.replace(/\..+?$/, '.' + partial.params.ext),
          dest = path.join(options.dest, path.relative(options.src, name));

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
    if (options.bundle && match(src)) {
      if (bases.indexOf(src) === -1) {
        bases.push(src);
      }
    }

    chain.then(append(src));
  });

  chain.run(function(err) {
    if (!err) {
      bundle(cb);
    } else {
      cb(err);
    }
  });
};
