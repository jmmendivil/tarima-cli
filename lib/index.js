var $ = require('./utils');

var path = require('path'),
    rimraf = require('rimraf'),
    tarima = require('tarima');

var readFiles = require('./read'),
    compileFiles = require('./compile');

module.exports = function(options, done) {
  var deps = {};

  if (options.force) {
    rimraf.sync(options.cache);

    if (!options.delete) {
      rimraf.sync(options.dest);
    } else {
      $.toArray(options.delete).forEach(function(dir) {
        rimraf.sync(path.join(options.dest, dir));
      });
    }
  }

  if ($.isFile(options.cache)) {
    deps = $.readJSON(options.cache);
  }

  var _ = $.chain();

  options.compileOptions = options.compileOptions || {};

  if (options.require) {
    $.toArray(options.require).forEach(function(file) {
      var cb = require(file);

      _.then(function(next) {
        if (cb.length === 2) {
          cb(options, next);
        } else {
          cb(options);
          next();
        }
      });
    });
  }

  if (options.extensions) {
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

  var replace = options.replace || '$1/$2.$3';

  if (options.bundle === true) {
    options.bundle = [/^(.+?)\/(\w+)\/(?:index|\2)\.((?!jade).*)$/, replace];
  }

  if (options.bundle instanceof RegExp) {
    options.bundle = [options.bundle, replace];
  }

  options.ignored = ['**/.*', '**/node_modules/**', '**/bower_components/**']
    .concat($.toArray(options.ignored));

  return readFiles(options, deps, function(err1, result) {
    if (err1) {
      return done(err1, result);
    }

    function build(err2) {
      if (err2) {
        return done(err2, result);
      }

      compileFiles(options, result, function(err3) {
        if (options.cache) {
          $.writeJSON(options.cache, result.dependencies);
        }

        done(err3, result);
      });
    }

    _.run(build);
  });
};

for (var key in tarima) {
  if (Object.prototype.hasOwnProperty.call(tarima, key)) {
    module.exports[key] = tarima[key];
  }
}