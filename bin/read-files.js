var fs = require('fs-extra'),
    path = require('path'),
    chokidar = require('chokidar'),
    anymatch = require('anymatch');

module.exports = function readFiles(options, deps, cb) {
  var src = [];

  var ready,
      timeout;

  var match = anymatch(['**'].concat(options.filter || []));

  function append(file) {
    var filepath = path.join(options.src, file),
        found = deps[file];

    if (!found) {
      deps[file] = {
        mtime: +fs.statSync(filepath).mtime
      };
    } else if (!fs.existsSync(filepath)) {
      found.deleted = true;
      console.log('TODO: warn about orphans');
    } else {
      delete found.deleted;

      if (found.deps) {
        console.log('TODO: append dependants');
      }
    }

    if (!found || found.deleted || (+fs.statSync(filepath).mtime > found.mtime)) {
      return true;
    }
  }

  function next() {
    cb({
      files: src,
      watcher: this,
      dependencies: deps
    });

    src = [];
  }

  return chokidar
    .watch('.', {
      cwd: options.src,
      ignored: /\/\.\w+/,
      ignoreInitial: false,
      followSymlinks: options.followSymlinks
    }).on('all', function(evt, file) {
      switch (evt) {
        case 'add':
        case 'change':
        case 'unlink':
          if (src.indexOf(file) === -1) {
            if (append(file) && match(file)) {
              src.push(file);
            }

            if (ready) {
              clearTimeout(timeout);
              timeout = setTimeout(next, options.interval || 50, this);
            }
          }
        break;
      }
    }).on('ready', function() {
      next.call(this);
      ready = true;
    });
};
