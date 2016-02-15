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

function escapeHTML(value){
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

module.exports = function(done) {
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

  var bs = browserSync.create();

  bs.init(bsOptions, function(err) {
    console.log($.style('{magenta|# Starting server at: http://localhost:%s}', bs.getOption('port')));
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
      bs.reload(result.files.map(function(src) {
        return path.relative(options.dest, result.dependencies[src].dest);
      }));
    }
  });
};
