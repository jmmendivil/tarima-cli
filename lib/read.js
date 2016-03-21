var glob = require('glob');

var chokidar;

function watch(cb) {
  chokidar = chokidar || require('chokidar');

  var src = [];

  var timeout,
      options = this.opts;

  function next(err) {
    cb(err, src);
    src = [];
  }

  function add(file) {
    src.push(file);
    clearTimeout(timeout);
    timeout = setTimeout(next.bind(this), options.interval || 50);
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
  }).on('ready', function() {
    next.call(this);
  }).on('error', function(e) {
    next.call(this, e);
  });
}

module.exports = function(cb) {
  if (this.opts.watch) {
    return watch.call(this, cb);
  }

  glob('**', {
    dot: true,
    nodir: true,
    nosort: true,
    ignore: this.opts.ignore,
    cwd: this.opts.src
  }, cb);
};
