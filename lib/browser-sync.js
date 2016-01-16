var $ = require('./utils');

var path = require('path'),
    browserSync = require('browser-sync');

function fixedBrowsers(value) {
  if (typeof value === 'string') {
    return value.replace(/\+/g, ' ').split(',').map(function(name) {
      return name === 'chrome' ? 'google chrome' : name;
    });
  }
}

module.exports = function() {
  var options = this.opts;

  var bsOptions = {
    logLevel: 'silent',
    port: options.port || 3000,
    open: options.open === true,
    browser: fixedBrowsers(options.browser) || 'default',
    snippetOptions: {
      rule: {
        match: /<\/body>|$/,
        fn: function(snippet, match) {
          return snippet + match;
        }
      }
    },
    injectChanges: true,
    ghostMode: false,
    directory: true,
    online: false,
    notify: true,
    ui: false
  };

  if (typeof options.proxy === 'string') {
    bsOptions.proxy = options.proxy;
  } else {
    bsOptions.server = {
      baseDir: options.dest
    };

    for (var k in options.serverOptions) {
      bsOptions.server[k] = options.serverOptions[k];
    }
  }

  var bs;

  var onError = this.emit.bind(null, 'error');

  this.on('error', function(message) {
    bs.notify('<pre style="text-align:left;color:red">' + message + '</pre>', 10000);
  });

  this.on('end', function(err1, result) {
    if (!bs) {
      bs = browserSync.create();
      bs.init(bsOptions, function(err2) {
        if (err2) {
          throw err2;
        }

        // TODO: replace this with a injectable logger
        console.log($.style('- {cyan|http://localhost:%s}', bs.getOption('port')));
      });
    } else if (err1) {
      onError(err1.toString());
    } else {
      bs.reload(result.files.map(function(src) {
        return path.relative(options.dest, result.dependencies[src].dest);
      }));
    }
  });
};
