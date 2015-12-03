var fs = require('fs-extra'),
    path = require('path'),
    chokidar = require('chokidar'),
    anymatch = require('anymatch');

module.exports = function readFiles(options, deps, cb) {
  var src = [];

  var ready,
      timeout;

  var match = anymatch(['**'].concat(options.ignore || []));

  function append(filepath) {
    var entry = deps[filepath];

    if (!entry) {
      entry = deps[filepath] = {};
    } else if (!fs.existsSync(filepath)) {
      entry.deleted = true;
      console.log('TODO: warn about orphans');
    } else {
      delete entry.deleted;
    }

    entry.dirty = !entry.mtime || entry.dirty || entry.deleted || (+fs.statSync(filepath).mtime > entry.mtime);

    if (!entry.dirty) {
      delete entry.dirty;
    } else {
      if (match(filepath) && (src.indexOf(filepath) === -1)) {
        src.push(filepath);
      }

      (entry.deps || []).forEach(function(id) {
        if (!deps[id].dirty) {
          deps[id].dirty = true;
          append(id);
        }
      });
    }
  }

  function next() {
    console.log(src);
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
          var filepath = path.join(options.src, file);

          append(filepath);

          if (ready) {
            clearTimeout(timeout);
            timeout = setTimeout(next, options.interval || 50, this);
          }
        break;
      }
    }).on('ready', function() {
      next.call(this);
      ready = true;
    });
};
