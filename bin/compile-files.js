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

  function track(id, deps) {
    (deps || []).forEach(function(src) {
      var entry = result.dependencies[src];

      if (!entry) {
        return;
      }

      if (!entry.deps) {
        entry.deps = [];
      }

      if (entry.deps.indexOf(id) === -1) {
        entry.deps.push(id);
      }
    });
  }

  function bundle(next) {
    var config = {
      entry: {},
      resolve: {
        extensions: ['', '.js'],
        modulesDirectories: ['node_modules']
      },
      output: {
        path: options.dest,
        filename: '[name]'
      }
    };

    bases.forEach(function(id) {
      var entry = result.dependencies[id];

      // TODO: improve file naming
      config.entry[entry.dest] = path.resolve(options.dest, entry.dest);
    });

    webpack(config, function(err, stats) {
      var data = stats.toJson();

      if (data.errors.length || data.warnings.length) {
        return next([err].concat(data.errors, data.warnings).join('\n'));
      }

      var deps = data.modules.map(function(chunk) {
        return result.dependencies[path.relative(options.dest, chunk.identifier)];
      });

      track(deps.shift(), deps);

      next(err);
    });
  }

  function append(file) {
    return function(next) {
      var partial = tarima.load(path.join(options.src, file), options);

      var data = partial.params.options.data || {},
          view = partial.data(data);

      var name = file.replace(/\..+?$/, '.' + partial.params.ext),
          dest = path.join(options.dest, name);

      fs.outputFileSync(dest, view.source);

      result.dependencies[file].mtime = +fs.statSync(dest).mtime;
      result.dependencies[file].dest = name;
      result.dependencies[name] = file;

      if (view.required) {
        track(file, view.required.map(function(src) {
          return path.relative(options.src, src);
        }));
      }

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
