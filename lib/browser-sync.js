var $ = require('./utils');

var fs = require('fs'),
    url = require('url'),
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

module.exports = function(done) {
  browserSync = browserSync || require('browser-sync');

  var exists = this.util.exists;

  var options = this.opts;

  var bsOptions = {
    logLevel: 'silent',
    port: options.port || process.env.PORT || 3000,
    open: options.open === true,
    browser: fixedBrowsers(options.browser) || 'default',
    plugins: [{
      hooks: {
        'client:js': fs.readFileSync(__dirname + '/bs-notifier.js')
      }
    }],
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
    bsOptions.serveStatic = [options.dest];
  } else {
    bsOptions.server = {
      index: 'index.html',
      baseDir: options.dest,
      middleware: [function(req, res, next) {
        var name = url.parse(req.url).pathname;

        // TODO: improve this behavior
        if (path.basename(name).indexOf('.') > -1) {
          return next();
        }

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
    bs.sockets.emit('bs:notify', message);

    $.notify('An error has occurred!', options.notifications.title, options.notifications.errIcon);
  });

  this.on('end', function(err, result) {
    if (err) {
      onError(err.toString());
    } else {
      var fixedFiles = result.changedFiles
        .map(function(entry) {
          return path.relative(options.dest, entry.dest);
        });

      if (fixedFiles.length) {
        bs.reload(fixedFiles);
        bs.sockets.emit('bs:notify:clear');
      }
    }
  });
};
