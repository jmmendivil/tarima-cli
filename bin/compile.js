var $ = require('./utils');

var path = require('path'),
    tarima = require('tarima'),
    browserify = require('browserify'),
    AsyncParts = require('async-parts');

module.exports = function compileFiles(options, result, cb) {
  var chain = new AsyncParts(),
      entries = [];

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

        var deps = [];

        var b = browserify(entry.dest, {
          paths: $.toArray(options.modules),
          commondir: false,
          detectGlobals: false,
          insertGlobals: false,
          bundleExternal: true
        });

        b.on('file', function(id) {
          if (!result.dependencies[id]) {
            return;
          }

          var src = result.dependencies[id].src;

          if (deps.indexOf(src) === -1) {
            deps.push(src);
          }
        });

        b.bundle(function(err, buffer) {
          if (!err) {
            var src = deps.shift();

            if (src) {
              track(src, deps);
            }

            $.write(entry.bundle, buffer.toString());
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
