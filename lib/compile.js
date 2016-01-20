var $ = require('./utils');

var path = require('path'),
    tarima = require('tarima'),
    through = require('through'),
    browserify = require('browserify');

function errSrc(file, line) {
  return file ? ' (' + file + ':' + line + ')' : '';
}

function errMark(lines, line, col, msg, src) {
  lines.splice(line, 0, [
    (new Array(col + 1)).join('-') + '^'
  ].join('\n'));

  return 'Error: ' + src + ':' + line + '\n'
    + lines.join('\n') + '\n' + msg.replace(/Error: /, '').trim();
}

function fixedError(err) {
  // jade
  if (err && err.path) {
    return err.toString();
  }

  // less
  if (err && err.extract) {
    return errMark(err.extract, err.line, err.column, err.message.trim(), err.filename);
  }

  // js-yaml
  if (err && err.mark) {
    return errMark(err.mark.buffer.split('\n'), err.mark.line, err.mark.column, err.reason.trim(), err.mark.name);
  }

  // coffee-script
  if (err && err.location) {
    return errMark(err.code.split('\n'), err.location.first_line, err.location.first_column, err.message.trim(), err.filename);
  }

  if (err && err.filename) {
    return err.toString().replace(/^((\w+:).+?)$/m, '$2 ' + err.filename)
      + ('fileName' in err ? '\n' + err.message : '');
  }
}

module.exports = function compileFiles(result, cb) {
  var options = this.opts;

  // custom events
  var onWrite = this.emit.bind(null, 'write');

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

    // ensure CommonJS wrapper
    params.exports = true;

    return params;
  }

  var _ = $.chain(function(err, next) {
    console.log($.color.red(fixedError(err) || err.toString().trim() + '\nat <' + err.filename + '>'));
    next();
  });

  function log(id) {
    console.log('|--------------------');
    console.log('|', $.style('{magenta|%s}', path.relative(options.src, id)));
  }

  function dest(id, ext) {
    return path.join(options.dest, path.relative(options.src, ext ? id.replace(/\..+?$/, '.' + ext) : id));
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

  function copy(filepath) {
    return function(next) {
      var target = {
        src: filepath,
        dest: dest(filepath)
      };

      sync(filepath);
      ensureRename(target);
      $.copy(target.src, target.dest);

      next();
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

            result.dependencies[src].dest = target;

            target = {
              src: file,
              dest: target,
              data: partial.params.options.data || {}
            };
          }

          try {
            code = render(partial, true).source;
          } catch (e) {
            e.filename = e.filename || src;
            return next(e);
          }

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

      result.dependencies[file].dest = target;

      try {
        var view = render(partial, partial.params.ext === 'js');
      } catch (e) {
        e.filename = e.filename || file;
        return next(e);
      }

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
    if (!tarima.util.isSupported(src)) {
      // TODO: hooks for another build tasks?
      _.then(copy(src));
    } else if (options.bundle && tarima.util.isScript(src) && !tarima.util.isView(src)) {
      _.then(bundle(src));
    } else {
      _.then(append(src));
    }
  });

  _.run(cb);
};
