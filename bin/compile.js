var $ = require('./utils');

var path = require('path'),
    tarima = require('tarima'),
    through = require('through'),
    browserify = require('browserify'),
    AsyncParts = require('async-parts');

function isTemplate(src) {
  return /\.(?:md|ract|jade|idom)/.test(src);
}

function isScript(src) {
  return /\.(js|es6|imba|jisp|(?:lit)?coffee)/.test(src);
}

module.exports = function compileFiles(options, result, cb) {
  var chain = new AsyncParts();

  function log(id) {
    console.log('|--------------------');
    console.log('|', $.style('{magenta|%s}', path.relative(options.src, id)));
  }

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
      log(file);

      var dest,
          deps = [];

      var b = browserify(file, {
        paths: $.toArray(options.modules),
        commondir: false,
        detectGlobals: false,
        insertGlobals: false,
        bundleExternal: true,
        extensions: ['.js', '.es6', '.imba', '.jisp', '.coffee', '.coffee.md', '.litcoffee', '.hbs', '.ejs']
      });

      b.on('file', function(id) {
        if (result.dependencies[id] && (deps.indexOf(id) === -1)) {
          deps.push(id);
        }
      });

      b.transform(function(src) {
        var code = '';

        return through(function(buf) {
          code += buf;
        }, function() {
          var partial = tarima.parse(src, code, options.compileOptions || {});

          if ((src === file) && options.bundle) {
            dest = match(path.join(options.dest, path.relative(options.src, src.replace(/\..+?$/, '.' + partial.params.ext))));
          }

          var data = partial.params.options.data || {},
              view = partial.data(data);

          this.queue(view.source);
          this.queue(null);
        });
      });

      b.bundle(function(err, buffer) {
        if (!err) {
          var src = deps.shift();

          if (src) {
            track(src, deps);
          }

          $.write(dest, buffer.toString());
        }

        next(err);
      });
    };
  }

  function append(file) {
    return function(next) {
      log(file);

      var partial = tarima.load(file, options.compileOptions || {});

      var data = partial.params.options.data || {},
          view = partial.data(data);

      var name = file.replace(/\..+?$/, '.' + partial.params.ext),
          dest = path.join(options.dest, path.relative(options.src, name));

      if (options.bundle && match(file)) {
        dest = match(dest);
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
    if (options.bundle) {
      if (match(src)) {
        chain.then((isScript(src) ? bundle : append)(src));
      } else if (isTemplate(src)) {
        chain.then(append(src));
      }
    } else {
      chain.then(append(src));
    }
  });

  chain.run(cb);
};
