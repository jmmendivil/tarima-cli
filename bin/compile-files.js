var fs = require('fs-extra'),
    path = require('path'),
    tarima = require('tarima'),
    AsyncParts = require('async-parts');

module.exports = function compileFiles(options, files, cb) {
  var chain = new AsyncParts();

  function append(file) {
    return function(next) {
      var filepath = path.join(options.src, file),
          partial = tarima.load(filepath);

      var data = partial.params.options.data || {},
          view = partial.data(data);

      var ext = options.rename[partial.params.ext] || partial.params.ext,
          dest = path.join(options.dest, file.replace(/\..+?$/, '.' + ext));

      fs.outputFileSync(dest, view.source);

      next();
    };
  }

  files.forEach(function(src) {
    chain.then(append(src));
  });

  chain.run(function(err) {
    cb(err);
  });
};
