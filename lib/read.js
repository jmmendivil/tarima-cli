var $ = require('./utils');

var path = require('path'),
    micromatch = require('micromatch');

var chokidar;

module.exports = function(deps, cb) {
  chokidar = chokidar || require('chokidar');

  var src = [];

  var ready,
      timeout;

  var options = this.opts;

  var match = micromatch.filter(['**'].concat(options.filtered || []), { dot: true });

  function append(filepath) {
    var entry = deps[filepath];

    if (!entry) {
      entry = deps[filepath] = {};
    } else if (!$.isFile(filepath)) {
      entry.deleted = true;
      delete deps[filepath];
      console.log('TODO: warn about orphans');
    } else {
      delete entry.deleted;
    }

    entry.dirty = !entry.mtime || entry.dirty || entry.deleted
      || ($.mtime(filepath) > entry.mtime)
      || options.force;

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

  function next(err) {
    cb(err, {
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
      timeout = setTimeout(next.bind(this), options.interval || 50);
    }
  }

  return chokidar
    .watch('.', {
      cwd: options.src,
      ignored: options.ignore,
      persistent: options.watch,
      ignoreInitial: false,
      followSymlinks: options.followSymlinks
    }).on('all', function(evt, file) {
      switch (evt) {
        case 'add':
        case 'change':
        case 'unlink':
          add.call(this, file);
        break;
      }
    }).on('ready', function() {
      next.call(this);
      ready = true;
    }).on('error', function(e) {
      next.call(this, e);
    });
};
