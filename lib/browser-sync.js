var url = require('url'),
    path = require('path');

var logger = require('./logger');

var browserSync;

function fixedBrowsers(value) {
  if (typeof value === 'string') {
    return value.replace(/\+/g, ' ').split(',').map(function(name) {
      return name === 'chrome' ? 'google chrome' : name;
    });
  }
}

function escapeHTML(value){
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = function(done) {
  browserSync = browserSync || require('browser-sync');

  var exists = this.util.exists;

  var options = this.opts;

  var bsOptions = {
    logLevel: 'silent',
    port: options.port || process.env.PORT || 3000,
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
    directory: false,
    online: false,
    notify: true,
    ui: false
  };

  if (typeof options.proxy === 'string') {
    bsOptions.proxy = options.proxy;
    bsOptions.serveStatic = options.dest;
  } else {
    bsOptions.server = {
      index: 'index.html',
      baseDir: options.dest,
      middleware: [function(req, res, next) {
        var file = path.join(options.dest, url.parse(req.url).pathname);

        if (!exists(file)) {
          req.url = '/index.html';
        }

        next();
      }]
    };

    for (var k in options.serverOptions) {
      bsOptions.server[k] = options.serverOptions[k];
    }
  }

  var bs = browserSync.create();

  bs.init(bsOptions, function(err) {
    logger.printf('{hint.cyanBright|Starting server at: http://localhost:%s/}\n', bs.getOption('port'));
    done(err);
  });

  var onError = this.emit.bind(null, 'error');

  this.on('error', function(message) {
    bs.notify('<pre style="margin:0;text-align:left;color:red">' + escapeHTML(message)
      + '\n\n<a style="cursor:pointer" onclick="__bs_notify__.style.display=\'none\'">&times; close this</a>'
      + '</pre>', 180000);
  });

  this.on('end', function(err, result) {
    if (err) {
      onError(err.toString());
    } else {
      var fixedFiles = [];

      result.files
        .forEach(function(src) {
          if (!result.dependencies[src].deleted) {
            fixedFiles.push(path.relative(options.dest, result.dependencies[src].dest));
          }
        });

      bs.reload(fixedFiles);
    }
  });
};
