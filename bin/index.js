var fs = require('fs-extra'),
    rimraf = require('rimraf'),
    tarima = require('tarima');

var readFiles = require('./read'),
    compileFiles = require('./compile');

module.exports = function(options, done) {
  options.compileOptions = options.compileOptions || {};

  if (options.require) {
    (!Array.isArray(options.require) ? [options.require] : options.require).forEach(function(file) {
      require(file)(options);
    });
  }

  var deps = {};

  if (options.force) {
    rimraf.sync(options.dest);
    rimraf.sync(options.cache);
  }

  if (fs.existsSync(options.cache)) {
    deps = fs.readJsonSync(options.cache);
  }

  if (options.extensions) {
    var filter = options.compileOptions.filter;

    options.compileOptions.filter = function(partial) {
      var ext = options.extensions[partial.ext];

      if (ext) {
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
    .concat(options.ignored ? (Array.isArray(options.ignored) ? options.ignored : [options.ignored]) : []);

  return readFiles(options, deps, function(result) {
    if (options.watch !== true) {
      result.watcher.close();
    }

    compileFiles(options, result, function(err) {
      if (options.cache) {
        fs.outputJsonSync(options.cache, result.dependencies);
      }

      done(err, result);
    });
  });
};

for (var key in tarima) {
  if (Object.prototype.hasOwnProperty.call(tarima, key)) {
    module.exports[key] = tarima[key];
  }
}
