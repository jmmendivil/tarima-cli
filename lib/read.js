var glob = require('glob');

var chokidar;

function watch(cb) {
  chokidar = chokidar || require('chokidar');

  var src = [];

  var timeout,
      cache = this.cache,
      options = this.opts;

  function next(err) {
    cb(err, src);
    src = [];
  }

  function add(file) {
    if (src.indexOf(file) === -1) {
      cache.set(file, 'dirty', true);
      src.push(file);

      clearTimeout(timeout);
      timeout = setTimeout(next.bind(this), options.interval || 200);
    }
  }

  chokidar.watch(options.src, {
    cwd: options.cwd,
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
    var files = glob.sync(this.opts.src, {
      dot: true,
      nodir: true,
      nosort: true,
      ignore: this.opts.ignore,
      cwd: this.opts.cwd
    });
  } catch (e) {
    return cb(e);
  }

  if (self.opts.watch) {
    watch.call(self, cb);
  }

  cb(undefined, files);
};
