var $ = require('./utils');

var path = require('path'),
    tarima = require('tarima'),
    through = require('through'),
    browserify = require('browserify');

function isView(src) {
  return /\.(jade|ract|idom|hbs|ejs)/.test(src);
}

function isScript(src) {
  return /\.(js|es6|imba|jisp|(?:lit)?coffee)/.test(src);
}

function isTemplate(view) {
  return /^\s*(?:function.*?|Handlebars\.template)\(/.test(view)
    && !/(?:module\.)?exports\s*=/.test(view);
}

function ensureWrapper(view) {
  if (isTemplate(view.source)) {
    view.source = [
      view.dependencies || '',
      'module.exports = ' + view.source + ';'
    ].join('\n');
  }
}

module.exports = function compileFiles(options, result, cb) {
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

  function render(partial) {
    var data = partial.params.options.data || {},
        view = partial.data(data, true);

    ensureWrapper(view);

    return view;
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
          '.es6.js',
          '.imba',
          '.jisp',
          '.coffee',
          '.coffee.md',
          '.litcoffee',
          // templating
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
          var partial = tarima.parse(src, code, options.compileOptions || {});

          if ((src === file) && options.bundle) {
            target = dest(src, partial.params.ext);
            target = match(target) || target;
          }

          this.queue(render(partial).source);
          this.queue(null);
        });
      });

      b.bundle(function(err, buffer) {
        if (!err) {
          var src = deps.shift();

          if (src) {
            track(src, deps);
          }

          $.write(target, buffer.toString());
        }

        next(err);
      });
    };
  }

  function append(file) {
    return function(next) {
      log(file);

      var partial = tarima.load(file, options.compileOptions || {}),
          target = dest(file, partial.params.ext);

      if (options.bundle && match(file)) {
        target = match(target);
      }

      var view = render(partial);

      $.write(target, view.source);

      track(file, view.required);

      next();
    };
  }

  result.files.forEach(function(src) {
    if (options.bundle) {
      _.then((isScript(src) && !isView(src) ? bundle : append)(src));
    } else {
      _.then(append(src));
    }
  });

  _.run(cb);
};
