var $ = require('./utils');

var path = require('path'),
    rimraf = require('rimraf'),
    tarima = require('tarima');

var readFiles = require('./read'),
    compileFiles = require('./compile');

module.exports = function(options, done) {
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

  if (options.extensions) {
    var filter = options.compileOptions.filter;

    options.compileOptions.filter = function(partial) {
      var ext = options.extensions[partial.parts[0]];

      if (ext && (partial.parts.indexOf(ext) === -1)) {
        partial.parts.unshift(ext);
        partial.ext = ext;
      }

      if (typeof filter === 'function') {
        filter(partial);
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

  return readFiles(options, deps, function(result) {
    if (options.watch !== true) {
      result.watcher.close();
    }

    function build() {
      compileFiles(options, result, function(err) {
        if (options.cache) {
          $.writeJSON(options.cache, result.dependencies);
        }

        done(err, result);
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
