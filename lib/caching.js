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
