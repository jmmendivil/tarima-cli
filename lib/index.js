var $ = require('./utils');

var path = require('path'),
    tarima = require('tarima'),
    micromatch = require('micromatch');

var readFiles = require('./read'),
    compileFiles = require('./compile');

var plugableSupportAPI = require('./hooks');

function errSrc(file, line) {
  return file ? ' (' + file + ':' + line + ')' : '';
}

function errMark(lines, line, col) {
  lines.splice(line, 0, (new Array(col + 1)).join('-') + '^');

  return lines.join('\n');
}

function fixedError(err) {
  // jade
  if (err && err.extract) {
    return errMark(err.extract, err.line + 1, err.column)
      + '\n' + err.message.trim() + errSrc(err.filename, err.line);
  }

  // js-yaml
  if (err && err.mark) {
    return errMark(err.mark.buffer.split('\n'), err.mark.line, err.mark.column)
      + '\n' + err.reason.trim() + errSrc(err.mark.name, err.mark.line);
  }
}

function makeReplacement(test, rename) {
  return function(value) {
    var ok = test(value);

    if (ok) {
      var ext = path.extname(value);

      return (rename || ok).replace('{filepath}', path.dirname(value))
        .replace('{filename}', path.basename(value, ext))
        .replace('{extname}', ext);
    }
  };
}

module.exports = function(options, done) {
  var context = plugableSupportAPI(options);

  if (!$.isDir(options.src)) {
    return done.call(context, 'Missing `' + options.src + '` directory');
  }

  var data,
      deps = {};

  var _ = $.chain(function(err, next) {
    console.log('TODO', err.stack);
    next();
  });

  options.require = options.require || [];
  options.ignored = options.ignored || [];
  options.filtered = options.filtered || [];
  options.extensions = options.extensions || {};
  options.serverOptions = options.serverOptions || {};
  options.compileOptions = options.compileOptions || {};

  if (options.require.length) {
    $.toArray(options.require).forEach(function(file) {
      var cb;

      try {
        cb = require(file);
      } catch (e) {
        cb = require(path.resolve(file));
      }

      _.then(function(next) {
        // ES6 interop
        cb = cb.default || cb;

        if (cb.length) {
          cb.call(context, next);
        } else {
          cb.call(context);
          next();
        }
      });
    });
  }

  _.then(function(next) {
    if ($.isFile(options.cache)) {
      deps = $.readJSON(options.cache);
    }

    if (Object.keys(options.extensions).length) {
      var filter = options.compileOptions.filter;

      options.compileOptions.filter = function(params) {
        var ext = options.extensions[params.parts[0]];

        if (ext && (params.parts.indexOf(ext) === -1)) {
          params.parts.unshift(ext);
          params.ext = ext;
        }

        if (typeof filter === 'function') {
          filter(params);
        }
      };
    }

    options.ignored = [
      '**/.{hg,svn,CVS,git,idea,cache,project,settings,tmproj}',
      '**/{tmp,cache,build,generated,node_modules,bower_components}/**',
    ].concat($.toArray(options.ignored));

    if (options.rename) {
      var replaceOpts = [];

      $.toArray(options.rename).forEach(function(test) {
        if (typeof test === 'function') {
          replaceOpts.push(makeReplacement(test));
        }

        if (typeof test === 'string') {
          test = test.split(':');
        }

        if (Array.isArray(test)) {
          test[0] = test[0] instanceof RegExp ? test[0] : micromatch.makeRe(test[0]);
          replaceOpts.push(makeReplacement(RegExp.prototype.test.bind(test[0]), test[1]));
        }
      });

      options.rename = function(view) {
        replaceOpts.forEach(function(cb) {
          // TODO: exhaustive or not?
          view.dest = cb(view.dest) || view.dest;
        });
      };
    }

    next();
  });

  function end(err) {
    if (options.cache) {
      $.writeJSON(options.cache, data.dependencies);
    }

    err = fixedError(err) || err;

    done.call(context, err, data);
    context.emit('end', err, data);
  }

  function build(err) {
    data.start = new Date();

    if (!err) {
      compileFiles.call(context, data, end);
    } else {
      end(err);
    }
  }

  _.then(function(next) {
    readFiles.call(context, deps, function(err, result) {
      data = result;

      if (next) {
        next();
        next = null;
      } else {
        build();
      }
    });
  });

  if (options.server || options.proxy) {
    _.then(function(next) {
      require('./browser-sync').call(context);
      next();
    });
  }

  _.run(build);
};

for (var key in tarima) {
  if (Object.prototype.hasOwnProperty.call(tarima, key)) {
    module.exports[key] = tarima[key];
  }
}
