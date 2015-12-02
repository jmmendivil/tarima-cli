var fs = require('fs-extra'),
    path = require('path'),
    tarima = require('tarima'),
    AsyncParts = require('async-parts');

module.exports = function compileFiles(options, result, cb) {
  var chain = new AsyncParts();

  function track(id, deps) {
    (deps || []).forEach(function(src) {
      var entry = result.dependencies[path.relative(options.src, src)];

      if (!entry) {
        return;
      }

      if (!entry.deps) {
        entry.deps = [];
      }

      if (entry.deps.indexOf(id) === -1) {
        entry.deps.push(id);
      }
    });
  }

  function append(file) {
    return function(next) {
      var filepath = path.join(options.src, file),
          partial = tarima.load(filepath);

      var data = partial.params.options.data || {},
          view = partial.data(data);

      var ext = options.rename[partial.params.ext] || partial.params.ext,
          dest = path.join(options.dest, file.replace(/\..+?$/, '.' + ext));

      fs.outputFileSync(dest, view.source);

      result.dependencies[file].mtime = +fs.statSync(dest).mtime;

      track(file, view.required);

      next();
    };
  }

  result.files.forEach(function(src) {
    chain.then(append(src));
  });

  chain.run(function(err) {
    cb(err);
  });
};
