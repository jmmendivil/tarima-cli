var fs = require('fs-extra'),
    tarima = require('tarima');

var readFiles = require('./read-files'),
    compileFiles = require('./compile-files');

module.exports = function(options, done) {
  var deps = options.dependencies || {};

  if (fs.existsSync(options.cache)) {
    deps = fs.readJsonSync(options.cache);
  }

  return readFiles(options, deps, function(result) {
    if (options.watch !== true) {
      result.watcher.close();
    }

    compileFiles(options, result.files, function(err) {
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
