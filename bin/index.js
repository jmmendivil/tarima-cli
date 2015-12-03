var fs = require('fs-extra'),
    tarima = require('tarima');

var readFiles = require('./read-files'),
    compileFiles = require('./compile-files');

module.exports = function(options, done) {
  var deps = options.dependencies || {};

  if (fs.existsSync(options.cache)) {
    deps = fs.readJsonSync(options.cache);
  }

  if (options.rename) {
    var filter = options.filter;

    options.filter = function(partial) {
      var ext = options.rename[partial.ext];

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
