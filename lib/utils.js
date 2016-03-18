var fs = require('fs-extra'),
    path = require('path'),
    clc = require('cli-color'),
    chain = require('siguiente'),
    prettyMs = require('pretty-ms'),
    resolve = require('tarima/resolve'),
    notifier =  require('node-notifier');

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

    if (Array.isArray(value)) {
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
  var _ = chain();

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

module.exports = {
  resolve: resolve,
  notify: notify,
  merge: merge,
  exists: exists,
  isDir: isDir,
  isFile: isFile,
  copy: fs.copySync,
  readJSON: fs.readJsonSync,
  writeJSON: fs.outputJsonSync,
  timeDiff: timeDiff,
  mtime: mtime,
  write: fs.outputFileSync,
  read: fs.readFileSync,
  toArray: toArray,
  chain: chain,
  color: clc
};
