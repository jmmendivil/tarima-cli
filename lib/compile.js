var $ = require('./utils');

var path = require('path'),
    tarima = require('tarima'),
    through = require('through'),
    browserify = require('browserify'),
    Readable = require('stream').Readable;

var reTemplateFunction = /^\s*\(?\s*function.*?\(/;

function ensureReadable(source) {
  var readable = new Readable({ objectMode: true });

  readable._read = function() {
    readable.push(source);
    readable.push(null);
  };

  return readable;
}

module.exports = function(result, done) {
  var options = this.opts;

  var bundleOptions = {
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
  };

  // custom events
  var onWrite = this.emit.bind(null, 'write');

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

  var _ = $.chain();

  _.catch(function(err, next) {
    if (process.env.CI) {
      done(err);
    } else {
      next(options.compileOptions.compileDebug ? err : null);
    }
  });

  function log(id, cb) {
    return function(next) {
      var a = path.relative(options.cwd, id);

      $.print($.color.yellow('↺ ' + a));

      var start = new Date();

      cb(function(err) {
        var b = path.relative(options.cwd, result.dependencies[id].dest);

        $.print($.color.erase.line);
        $.print($.color.move.left(a.length + 2));

        if (!err) {
          $.print($.color.green('✓ ' + b + ' in ' + $.timeDiff(start)));

          result.ok.push(id);
        } else {
          $.print($.color.red('✗ ' + a));

          result.err.push(id);
        }

        $.print('\n');

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
        $.print($.color.cyan('✓ ' + b + ' in ' + $.timeDiff(start)) + '\n');

        result.ok.push(id);
      } catch (e) {
        err = e;

        result.err.push(id);

        $.print($.color.red('✗ ' + b + '\n'));
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
    partial.render(function(err, output) {
      if (err) {
        return next(err);
      }

      var file = output.src,
          target = dest(file, output.ext);

      result.dependencies[file].dest = target;

      var data = partial.params.options.data || {},
          deps = [],
          opts = {};

      // TODO: merge from options.bundleOptions?
      $.merge(opts, bundleOptions);

      if (typeof data._bundle === 'string') {
        opts.standalone = data._bundle;
        delete data._bundle;
      }

      opts.basedir = path.dirname(file);
      opts.entries = ensureReadable(output.code);

      var b = browserify(opts);

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
          var self = this;

          tarima.parse(src, code, tarimaOpts()).render(function(e, out) {
            if (e) {
              return next(e);
            }

            self.queue(out.code);
            self.queue(null);
          });
        });
      });

      b.bundle(function(err, buffer) {
        if (!err) {
          target = {
            src: file,
            dest: target,
            locals: output.locals
          };

          var index = track.bind(null, target.src);

          index(deps);

          target.output = buffer.toString();

          ensureWrite(target, index);
        }

        next(err);
      });
    });
  }

  function append(partial, next) {
    partial.render(function(err, output) {
      if (!err) {
        var file = output.src,
            target = dest(file, output.ext);

        result.dependencies[file].dest = target;

        var index = track.bind(null, file);

        index(output.required);

        if (tarima.support.isScript(output.ext) && reTemplateFunction.test(output.code)) {
          var prefix = tarima.support.getRuntime(partial.params.parts[1]);

          output.code = (prefix ? prefix + '\n' : '')
            + 'module.exports=' + output.code;
        }

        ensureWrite({
          src: file,
          dest: target,
          output: output.code,
          locals: output.locals
        }, index);
      }

      next(err);
    });
  }

  result.files.forEach(function(src) {
    if (!tarima.support.isSupported(src)) {
      // TODO: support for extra tasks?
      _.then(copy(src));
    } else {
      _.then(log(src, function(next) {
        var partial = tarima.load(src, tarimaOpts());

        var isScript = tarima.support.isScript(partial.params.ext),
            isTemplate = partial.params.parts.filter(tarima.support.isTemplate).length;

        if (options.bundle && isScript && !isTemplate) {
          compile(partial, next);
        } else {
          append(partial, next);
        }
      }));
    }
  });

  _.run(done);
};
