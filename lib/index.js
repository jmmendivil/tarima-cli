var $ = require('./utils');

var path = require('path'),
    tarima = require('tarima');

var readFiles = require('./read'),
    compileFiles = require('./compile');

var plugableSupportAPI = require('./hooks');

function fixedError(err) {
  return [
    err.extract.join('\n'),
    (new Array(err.column + 1)).join(' ') + '^',
    '\n' + err.message + (err.filename ? ' (' + err.filename + ')' : '')
  ].join('\n');
}

module.exports = function(options, done) {
  var deps = {};

  if (!$.isDir(options.src)) {
    return done('Missing `' + options.src + '` directory');
  }

  if ($.isFile(options.cache)) {
    deps = $.readJSON(options.cache);
  }

  var _ = $.chain();

  var context = plugableSupportAPI(options);

  if (options.server) {
    require('./browser-sync').call(context);
  }

  options.compileOptions = options.compileOptions || {};

  if (options.require) {
    $.toArray(options.require).forEach(function(file) {
      var cb;

      try {
        cb = require(file);
      } catch (e) {
        cb = require(path.resolve(file));
      }

      _.then(function(next) {
        if (cb.length === 2) {
          cb.call(context, next);
        } else {
          cb.call(context);
          next();
        }
      });
    });
  }

  if (options.extensions) {
    var filter = options.compileOptions.filter;

    options.compileOptions.filter = function(params) {
      var ext = options.extensions[params.parts[0]];

      if (ext && (params.parts.indexOf(ext) === -1)) {
        params.parts.unshift(ext);
        params.ext = ext;
      }

      if (typeof filter === 'function') {
        filter(params);
      }
    };
  }

  var replace = options.replace || '$1/$2.$3';

  if (options.bundle === true) {
    options.bundle = [/^(.+?)\/(\w+)\/(?:index|\2)\.((?!jade).*)$/, replace];
  }

  if (options.bundle instanceof RegExp) {
    options.bundle = [options.bundle, replace];
  }

  options.ignored = ['**/.*', '**/node_modules/**', '**/bower_components/**']
    .concat($.toArray(options.ignored));

  // TODO: improve error handling
  return readFiles.call(context, deps, function(err1, result) {
    function end(err) {
      if (options.cache) {
        $.writeJSON(options.cache, result.dependencies);
      }

      if (err && err.extract && err.column) {
        err = fixedError(err);
      }

      done(err, result);

      context.emit('end', err, result);
    }

    if (err1) {
      return end(err1);
    }

    function build(err2) {
      result.start = new Date();

      if (!err2) {
        compileFiles.call(context, result, end);
      } else {
        end(err2);
      }
    }

    _.run(build);
  });
};

for (var key in tarima) {
  if (Object.prototype.hasOwnProperty.call(tarima, key)) {
    module.exports[key] = tarima[key];
  }
}
