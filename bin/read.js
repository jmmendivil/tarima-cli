var $ = require('./utils');

var path = require('path'),
    chokidar = require('chokidar'),
    micromatch = require('micromatch');

module.exports = function readFiles(options, deps, cb) {
  var src = [];

  var ready,
      timeout;

  var match = micromatch.filter(['**'].concat(options.filtered || []));

  function append(filepath) {
    var entry = deps[filepath];

    if (!entry) {
      entry = deps[filepath] = {};
    } else if (!$.isFile(filepath)) {
      entry.deleted = true;
      console.log('TODO: warn about orphans');
    } else {
      delete entry.deleted;
    }

    entry.dirty = !entry.mtime || entry.dirty || entry.deleted || ($.mtime(filepath) > entry.mtime);

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
    cb({
      files: src,
      watcher: this,
      dependencies: deps
    });

    src = [];
  }

  function add(file) {
    append(path.join(options.src, file));

    if (ready) {
      clearTimeout(timeout);
      timeout = setTimeout(next, options.interval || 50, this);
    }
  }

  return chokidar
    .watch('.', {
      cwd: options.src,
      ignored: options.ignored,
      ignoreInitial: false,
      followSymlinks: options.followSymlinks
    }).on('all', function(evt, file) {
      switch (evt) {
        case 'add':
        case 'change':
        case 'unlink':
          add(file);
        break;
      }
    }).on('ready', function() {
      next.call(this);
      ready = true;
    });
};
