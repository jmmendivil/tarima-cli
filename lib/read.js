var glob = require('glob'),
    path = require('path');

var chokidar;

function watch(cb) {
  chokidar = chokidar || require('chokidar');

  var src = [];

  var cache = this.cache,
      srcDir = this.opts.src;

  var timeout,
      options = this.opts;

  function next(err) {
    cb(err, src);
    src = [];
  }

  function add(file) {
    if (src.indexOf(file) === -1) {
      cache.set(path.join(srcDir, file), 'dirty', true);
      src.push(file);

      clearTimeout(timeout);
      timeout = setTimeout(next.bind(this), options.interval || 100);
    }
  }

  chokidar.watch('.', {
    cwd: options.src,
    ignored: options.ignore,
    persistent: true,
    ignoreInitial: true,
    followSymlinks: options.followSymlinks
  }).on('all', function(evt, file) {
    switch (evt) {
      case 'add':
      case 'change':
      case 'unlink':
        add.call(this, file);
      break;
    }
  }).on('error', function(e) {
    next.call(this, e);
  });
}

module.exports = function(cb) {
  var self = this;

  try {
    var files = glob.sync('**', {
      dot: true,
      nodir: true,
      nosort: true,
      ignore: this.opts.ignore,
      cwd: this.opts.src
    });
  } catch (e) {
    return cb(e);
  }

  if (self.opts.watch) {
    watch.call(self, cb);
  }

  cb(undefined, files);
};
