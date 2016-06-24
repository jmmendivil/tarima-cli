var $ = require('./utils');

var path = require('path'),
    micromatch = require('micromatch');

var logger = require('./logger'),
    readFiles = require('./read'),
    compileFiles = require('./compile');

var plugableSupportAPI = require('./hooks'),
    cacheableSupportAPI = require('./caching');

function makeReplacement(dir, test, rename) {
  return function(value) {
    var rel = path.relative(dir, value);

    var ok = test(rel);

    if (ok) {
      var ext = path.extname(rel);

      // support for dynamic path slicing and rename strategy
      return path.join(dir, (rename || ok).replace(/\{filepath(?:\/(.+?))?\}/, function(_, match) {
          var parts = path.dirname(rel).split('/');
          var keys = match.split('/');

          var h = 0;
          var j = 0;
          var test = [];

          while (true) {
            var a = parts[j], b = keys[h];

            if (typeof a === 'undefined' && b) {
              break;
            }

            if (typeof b === 'undefined' && typeof a === 'undefined') {
              break;
            }

            if (/^\d+$/.test(b)) {
              parts.splice(j, +b);
              j = 0;
              h++;
              continue;
            }

            if (a === b) {
              h++;
              parts[j] = keys[h];
              h++;
              j++;
              continue;
            }

            test.push(a);
            j++;
          }

          return test.join('/');
        })
        .replace('{filename}', path.basename(rel, ext))
        .replace('{extname}', ext.substr(1)));
    }
  };
}

function complexFactor(test) {
  return test.split('/').length * test.split('**').length;
}

module.exports = function(options, done) {
  if (!Array.isArray(options.bundle)) {
    options.bundle = options.bundle === true ? ['**'] : options.bundle ? [options.bundle] : [];
  }

  // resolve all relative paths
  ['dest', 'public', 'cacheFile', 'rollupFile'].forEach(function(subpath) {
    if (options[subpath]) {
      options[subpath] = Array.isArray(options[subpath]) ?
        options[subpath].map(function(subdir) {
          return path.resolve(options.cwd, subdir);
        }) : path.resolve(options.cwd, options[subpath]);
    }
  });

  var context = plugableSupportAPI(logger, options);

  options.locals = options.locals || {};
  options.rename = options.rename || [];
  options.plugins = options.plugins || [];
  options.ignore = options.ignore || [];

  // internally used
  context.cache = cacheableSupportAPI(options.cacheFile);
  context.match = $.makeFilter(options.filter || []);

  options.pluginOptions = options.pluginOptions || {};
  options.bundleOptions = options.bundleOptions || {};
  options.bundleOptions.locals = options.bundleOptions.locals || {};
  options.bundleOptions.globals = options.bundleOptions.globals || {};

  function die(error) {
    done.call(context, Array.isArray(error) ? error.map(function(err) {
      return err.message || err.toString();
    }).join('\n') : error);
  }

  if (!$.exists(options.dest)) {
    options.force = true;
  }

  var src = [];

  var _ = $.chain(function(err, next) {
    die(err);
    next();
  });

  if (options.plugins.length) {
    $.toArray(options.plugins)
      .map(function(file) {
        var fixedModule;

        try { fixedModule = $.moduleResolve(file); }
        catch (e) { /* do nothing */ }

        try {
          return require(fixedModule === file ? path.resolve(file) : fixedModule);
        } catch (e) { die(e); }
      })
      .sort(function(a, b) {
        return b.length - a.length;
      })
      .forEach(function(cb) {
        _.then(function(next) {
          if (!cb) {
            return next();
          }

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
    if (options.ignoreFiles) {
      options.ignoreFiles.forEach(function(ifile) {
        if ($.isFile(ifile)) {
          var lines = $.read(ifile).toString().split('\n');

          lines.forEach(function(line) {
            if (line.length && (line[0] !== '#') && (options.ignore.indexOf(line) === -1)) {
              var offset = line.indexOf('/');

              if (offset === -1) {
                options.ignore.push('**/' + line);
                options.ignore.push('**/' + line + '/**');
                options.ignore.push(line + '/**');
                options.ignore.push(line);
                return;
              }

              if (offset === 0) {
                line = line.substring(1);
              }

              if (line.charAt(line.length - 1) === '/') {
                options.ignore.push(line.slice(0, -1));
                options.ignore.push(line + '**');
              } else {
                options.ignore.push(line);
              }
            }
          });
        }
      });
    }

    if (options.rename) {
      var replaceOpts = $.toArray(options.rename).map(function(test) {
        if (typeof test === 'function') {
          return { cb: makeReplacement(options.dest, test) };
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

          re.cb = makeReplacement(options.dest, RegExp.prototype.test.bind(test[0]), test[1]);

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
            view.dest = path.relative(options.cwd, dest);
            break;
          }
        }
      };
    }

    next();
  });

  // TODO: fix this....

  function end(err, result) {
    context.cache.save();
    context.emit('end', err, result);

    done.call(context, err, result);
  }

  function build(err) {
    if (!err) {
      compileFiles.call(context, src, end);
    } else {
      end(err);
    }
  }

  _.run(function(err) {
    if (err) {
      end(err);
    } else {
      readFiles.call(context, function(err2, files) {
        src = files;
        build(err2);
      });
    }
  });
};
