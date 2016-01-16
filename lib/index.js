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

  var deps = {};

  if ($.isFile(options.cache)) {
    deps = $.readJSON(options.cache);
  }

  var _ = $.chain();

  if (options.server || options.proxy) {
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

      err = fixedError(err) || err;

      done.call(context, err, result);

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
