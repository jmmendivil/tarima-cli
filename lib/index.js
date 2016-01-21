var $ = require('./utils');

var path = require('path'),
    tarima = require('tarima'),
    micromatch = require('micromatch');

var readFiles = require('./read'),
    compileFiles = require('./compile');

var plugableSupportAPI = require('./hooks');

function complexFactor(test) {
  return test.split('/').length * test.split('**').length;
}

function makeReplacement(test, rename) {
  return function(value) {
    var ok = test(value);

    if (ok) {
      var ext = path.extname(value);

      return (rename || ok).replace('{filepath}', path.dirname(value))
        .replace('{filename}', path.basename(value, ext))
        .replace('{extname}', ext.substr(1));
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

  options.locals = options.locals || {};
  options.rename = options.rename || [];
  options.modules = options.modules || [];
  options.require = options.require || [];
  options.ignored = options.ignored || [];
  options.filtered = options.filtered || [];
  options.extensions = options.extensions || {};
  options.serverOptions = options.serverOptions || {};
  options.compileOptions = options.compileOptions || { globals: {} };

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
        if (typeof filter === 'function') {
          filter(params);
        }

        $.toArray(options.extensions[params.parts[0]]).reverse().forEach(function(ext) {
          if (ext && (params.parts.indexOf(ext) === -1)) {
            params.parts.unshift(ext);
            params.ext = ext;
          }
        });
      };
    }

    options.ignored = [
      '**/.{hg,svn,CVS,git,idea,cache,project,settings,tmproj}',
      '**/{tmp,cache,build,generated,node_modules,bower_components}/**',
    ].concat($.toArray(options.ignored));

    if (options.rename) {
      var replaceOpts = $.toArray(options.rename).map(function(test) {
        if (typeof test === 'function') {
          return { cb: makeReplacement(test) };
        }

        if (typeof test === 'string') {
          test = test.split(':');
        }

        if (Array.isArray(test)) {
          var re = {},
              isRe = test[0] instanceof RegExp;

          re[isRe ? 're' : 'str'] = test[0];

          if (!isRe) {
            test[0] = micromatch.makeRe(test[0]);
          }

          re.cb = makeReplacement(RegExp.prototype.test.bind(test[0]), test[1]);

          return re;
        }
      });

      // TODO: organize helpers...
      replaceOpts.sort(function(a, b) {
        if (a.cb) {
          return b.cb ? 0 : b.re ? 1 : -1;
        }

        if (a.re) {
          return b.cb ? 1 : b.re ? 0 : -1;
        }

        return a.str && b.str ? complexFactor(b.str) - complexFactor(a.str) : 1;
      });

      options.rename = function(view) {
        for (var key in replaceOpts) {
          var test = replaceOpts[key],
              dest = test.cb(view.dest);

          if (dest) {
            view.dest = dest;
            break;
          }
        }
      };
    }

    next();
  });

  function end(err) {
    if (options.cache) {
      $.writeJSON(options.cache, data.dependencies);
    }

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
    console.log($.style('{blackBright|# Reading files from: %s}', options.src));
    console.log($.style('{blackBright|# Compiled to: %s}', options.dest));

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
      require('./browser-sync').call(context, next);
    });
  }

  _.run(build);
};

for (var key in tarima) {
  if (Object.prototype.hasOwnProperty.call(tarima, key)) {
    module.exports[key] = tarima[key];
  }
}
