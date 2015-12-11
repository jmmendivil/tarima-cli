var fs = require('fs-extra'),
    clc = require('cli-color'),
    AsyncParts = require('async-parts');

function env(value) {
  if (typeof value === 'string') {
    return value.replace(/\$\{(\w+)\}/g, function(match, key) {
      return process.env[key] || match;
    });
  }

  return value;
}

function merge(target, source) {
  for (var key in source) {
    var value = source[key];

    if (!target[key]) {
      target[key] = value;
    }

    if (value !== null && typeof value === 'object') {
      merge(target[key], value);
    } else {
      target[key] = env(typeof value === 'undefined' ? target[key] : value);
    }
  }
}

function style(message) {
  var args = Array.prototype.slice.call(arguments, 1);

  return message.replace(/\{([.\w]+)\|([^{}]+)\}/g, function() {
    var colors = arguments[1],
        msg = arguments[2];

    var colorized = clc,
        segments = colors.split('.');

    while (segments.length) {
      var key = segments.shift();

      if (!colorized[key]) {
        break;
      }

      colorized = colorized[key];
    }

    return colorized(msg);
  }).replace(/%s/g, function() {
    return args.shift();
  });
}

function isDir(filepath) {
  try {
    return fs.statSync(filepath).isDirectory();
  } catch (e) {
    // noop
  }
}

function isFile(filepath) {
  try {
    return fs.statSync(filepath).isFile();
  } catch (e) {
    // noop
  }
}

function exists(filepath) {
  return isDir(filepath) || isFile(filepath);
}

function readJSON(filepath) {
  return fs.readJsonSync(filepath);
}

function writeJSON(filepath, data) {
  fs.outputJsonSync(filepath, data);
}

function timeDiff(start) {
  var diff = (new Date()) - start;

  if (diff > 1000) {
    return (diff / 1000).toFixed() + 's';
  }

  return diff + 'ms';
}

function mtime(filepath) {
  return +fs.statSync(filepath).mtime;
}

function write(filepath, content) {
  return fs.outputFileSync(filepath, content);
}

function toArray(obj) {
  if (!obj) {
    return [];
  }

  return !Array.isArray(obj) ? [obj] : obj;
}

function chain(callback) {
  var _ = new AsyncParts();

  if (callback) {
    _.catch(callback);
  }

  return _;
}

module.exports = {
  merge: merge,
  style: style,
  exists: exists,
  isDir: isDir,
  isFile: isFile,
  readJSON: readJSON,
  writeJSON: writeJSON,
  timeDiff: timeDiff,
  mtime: mtime,
  write: write,
  toArray: toArray,
  chain: chain
};