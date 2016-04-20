var $ = require('./utils');

module.exports = function(cacheFile) {
  var cache = $.isFile(cacheFile)
    ? $.readJSON(cacheFile) || {}
    : {};

  return {
    get: function(key) {
      return cache[key];
    },
    set: function(key, val, x) {
      if (x) {
        if (!cache[key]) {
          cache[key] = {};
        }

        cache[key][val] = x;
      } else {
        cache[key] = val;
      }
    },
    find: function(key) {
      if (cache[key]) {
        return cache[key];
      }

      for (var file in cache) {
        if (cache[file].id === key) {
          return cache[file];
        }

        if (cache[file].path && cache[file].path.relative === key) {
          return cache[file];
        }
      }
    },
    each: function(fn) {
      for (var key in cache) {
        fn(cache[key], key);
      }
    },
    save: function() {
      if (cacheFile) {
        $.writeJSON(cacheFile, cache);
      }
    }
  };
};
