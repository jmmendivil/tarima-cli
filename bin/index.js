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

  return readFiles(options, deps, function(result) {
    if (options.watch !== true) {
      result.watcher.close();
    }

    compileFiles(options, result, function(err) {
      if (options.cache) {
        fs.outputJsonSync(options.cache, result.dependencies);
      }

      done(err);
    });
  });
};

for (var key in tarima) {
  if (Object.prototype.hasOwnProperty.call(tarima, key)) {
    module.exports[key] = tarima[key];
  }
}
