var $ = require('./utils');

var path = require('path'),
    tarima = require('tarima');

var readFiles = require('./read'),
    compileFiles = require('./compile');

var plugableSupportAPI = require('./hooks');

function errSrc(file, line) {
  return file ? ' (' + file + ':' + line + ')' : '';
}

function errMark(lines, line, col) {
  lines.splice(line, 0, (new Array(col + 1)).join('-') + '^');

  return lines.join('\n');
}

function fixedError(err) {
  // jade
  if (err && err.extract) {
    return errMark(err.extract, err.line + 1, err.column)
      + '\n' + err.message.trim() + errSrc(err.filename, err.line);
  }

  // js-yaml
  if (err && err.mark) {
    return errMark(err.mark.buffer.split('\n'), err.mark.line, err.mark.column)
      + '\n' + err.reason.trim() + errSrc(err.mark.name, err.mark.line);
  }
}

module.exports = function(options, done) {
  var context = plugableSupportAPI(options);

  if (!$.isDir(options.src)) {
    return done.call(context, 'Missing `' + options.src + '` directory');
  }

  var data,
      deps = {};

  var _ = $.chain(function(err, next) {
    console.log('TODO', err);
    next();
  });

  options.require = options.require || [];
  options.ignored = options.ignored || [];
  options.filtered = options.filtered || [];
  options.extensions = options.extensions || {};
  options.serverOptions = options.serverOptions || {};
  options.compileOptions = options.compileOptions || {};

  if (options.require.length) {
    $.toArray(options.require).forEach(function(file) {
      var cb;

      try {
        cb = require(file);
      } catch (e) {
        cb = require(path.resolve(file));
      }

      _.then(function(next) {
        // ES6 interop
        cb = cb.default || cb;

        if (cb.length === 2) {
          cb.call(context, next);
        } else {
          cb.call(context);
          next();
        }
      });
    });
  }

  _.then(function(next) {
    if ($.isFile(options.cache)) {
      deps = $.readJSON(options.cache);
    }

    if (Object.keys(options.extensions).length) {
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

    next();
  });

  function end(err) {
    if (options.cache) {
      $.writeJSON(options.cache, data.dependencies);
    }

    err = fixedError(err) || err;

    done.call(context, err, data);
    context.emit('end', err, data);
  }

  function build(err) {
    data.start = new Date();

    if (!err) {
      compileFiles.call(context, data, end);
    } else {
      end(err);
    }
  }

  _.then(function(next) {
    readFiles.call(context, deps, function(err, result) {
      data = result;

      if (next) {
        next();
        next = null;
      } else {
        build();
      }
    });
  });

  if (options.server || options.proxy) {
    _.then(function(next) {
      require('./browser-sync').call(context);
      next();
    });
  }

  _.run(build);
};

for (var key in tarima) {
  if (Object.prototype.hasOwnProperty.call(tarima, key)) {
    module.exports[key] = tarima[key];
  }
}
