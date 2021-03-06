var fs = require('fs-extra'),
    path = require('path'),
    clc = require('cli-color'),
    _chain = require('siguiente'),
    prettyMs = require('pretty-ms'),
    micromatch = require('micromatch'),
    notifier =  require('node-notifier'),
    Promise = require('es6-promise').Promise;

var _paths = [];

var Module = require('module');

Module.globalPaths.forEach(function(_path) {
  if (_path.indexOf('node_') === -1) {
    Array.prototype.push.apply(_paths, Module._nodeModulePaths(_path));
  } else {
    _paths.push(_path);
  }
});

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

    if (Array.isArray(value) && (!target[key] || Array.isArray(target[key]))) {
      if (!target[key]) {
        target[key] = [];
      }

      value.forEach(function(item) {
        var fixedItem = env(item);

        if (target[key].indexOf(fixedItem) === -1) {
          target[key].push(fixedItem);
        }
      });
    } else if (value !== null && typeof value === 'object') {
      merge(target[key] || (target[key] = {}), value);
    } else if (typeof value !== 'undefined') {
      target[key] = env(value);
    }
  }
}

function flatten(items) {
  var out = [];

  items.forEach(function(set) {
    if (Array.isArray(set)) {
      Array.prototype.push.apply(out, flatten(set));
    } else if (set) {
      out.push(set);
    }
  });

  return out;
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

function timeDiff(start) {
  return prettyMs((new Date()) - start);
}

function mtime(filepath) {
  return +fs.statSync(filepath).mtime;
}

function toArray(obj) {
  if (!obj) {
    return [];
  }

  return !Array.isArray(obj) ? [obj] : obj;
}

function chain(callback) {
  var _ = _chain();

  if (callback) {
    _.catch(callback);
  }

  return _;
}

function notify(message, title, icon) {
  var noticeObj = {
    title: title,
    message: message
  };

  if (exists(icon)) {
    noticeObj.icon = path.resolve(icon);
  }

  notifier.notify(noticeObj);
}

function promisify(fn, context) {
  return function() {
    var args = Array.prototype.slice.call(arguments);

    return new Promise(function(resolve, reject) {
      var callback = function(err) {
        if (err) {
          return reject( err );
        }

        resolve.apply(null, Array.prototype.slice.call(arguments, 1));
      };

      args.push(callback);
      fn.apply(context, args);
    });
  };
}

function moduleResolve(name) {
  for (var key in _paths) {
    var fixedDir = path.join(_paths[key], name);

    if (isDir(fixedDir)) {
      return Module._resolveFilename(fixedDir);
    }
  }

  return name;
}

function makeFilter(filters) {
  filters = filters.map(function(filter) {
    return micromatch.matcher(filter, {
      dot: true
    });
  });

  // micromatch.filter() didn't work as expected
  return function(filepath) {
    var length = filters.length;
    var res = false;

    while (length--) {
      if (filters[length](filepath)) {
        res = true;
        break;
      }
    }

    return res;
  };
}

module.exports = {
  moduleResolve: moduleResolve,
  makeFilter: makeFilter,
  promisify: promisify,
  notify: notify,
  merge: merge,
  exists: exists,
  isDir: isDir,
  isFile: isFile,
  copy: fs.copySync,
  unlink: fs.unlinkSync,
  readJSON: fs.readJsonSync,
  writeJSON: fs.outputJsonSync,
  timeDiff: timeDiff,
  mtime: mtime,
  write: fs.outputFileSync,
  read: fs.readFileSync,
  toArray: toArray,
  flatten: flatten,
  chain: chain,
  color: clc
};
