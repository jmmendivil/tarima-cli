var $ = require('./utils');

var path = require('path'),
    tarima = require('tarima'),
    through = require('through'),
    browserify = require('browserify');

module.exports = function compileFiles(result, cb) {
  var options = this.opts;

  // custom events
  var onWrite = this.emit.bind(null, 'write');

  function tarimaOpts() {
    var params = {};

    for (var key in options.compileOptions) {
      params[key] = options.compileOptions[key];
    }

    // ensure CommonJS wrapper
    params.exports = true;

    return params;
  }

  function ensureWrite(view, index) {
    // TODO: support for rewrite (e.g. **/*.css => assets/styles)
    // console.log('RE', view.data, options.rewrite);

    onWrite(view, index);
    $.write(view.dest, view.output);
  }

  var _ = $.chain();

  function log(id) {
    console.log('|--------------------');
    console.log('|', $.style('{magenta|%s}', path.relative(options.src, id)));
  }

  function dest(id, ext) {
    return path.join(options.dest, path.relative(options.src, id.replace(/\..+?$/, '.' + ext)));
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

  function render(partial, raw) {
    return partial.data(options.locals, raw);
  }

  function bundle(file) {
    return function(next) {
      log(file);

      var deps = [],
          target;

      var b = browserify(file, {
        paths: $.toArray(options.modules),
        commondir: false,
        detectGlobals: false,
        insertGlobals: false,
        bundleExternal: true,
        extensions: [
          // known stuff
          '.js',
          '.jsx',
          '.es6.js',
          '.imba',
          '.jisp',
          '.coffee',
          '.coffee.md',
          '.litcoffee',
          // templating (TODO: improve this list)
          '.less', '.ract', '.idom', '.jade', '.hbs', '.ejs',
          '.ract.jade', '.idom.jade', '.hbs.jade', '.ejs.jade',
          '.js.less', '.js.ract', '.js.idom', '.js.jade', '.js.hbs', '.js.ejs',
          '.js.ract.jade', '.js.idom.jade', '.js.hbs.jade', '.js.ejs.jade'
        ]
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
          var partial = tarima.parse(src, code, tarimaOpts());

          if ((src === file) && options.bundle) {
            target = dest(src, partial.params.ext);
            target = match(target) || target;

            result.dependencies[src].dest = target;

            target = {
              src: file,
              dest: target,
              data: partial.params.options.data || {}
            };
          }

          code = render(partial, true).source;

          this.queue(code);
          this.queue(null);
        });
      });

      b.bundle(function(err, buffer) {
        if (!err) {
          var index = track.bind(null, target.src);

          index(deps.slice(1));

          target.output = buffer.toString();

          ensureWrite(target, index);
        }

        next(err);
      });
    };
  }

  function append(file) {
    return function(next) {
      log(file);

      var partial = tarima.load(file, tarimaOpts()),
          target = dest(file, partial.params.ext);

      if (options.bundle && match(file)) {
        target = match(target);
      }

      result.dependencies[file].dest = target;

      var view = render(partial, partial.params.ext === 'js');

      var index = track.bind(null, file);

      index(view.required);

      ensureWrite({
        src: file,
        dest: target,
        data: view.options.data || {},
        output: view.source
      }, index);

      next();
    };
  }

  result.files.forEach(function(src) {
    if (options.bundle) {
      _.then((tarima.util.isScript(src) && !tarima.util.isView(src) ? bundle : append)(src));
    } else {
      _.then(append(src));
    }
  });

  _.run(cb);
};
