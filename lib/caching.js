var $ = require('./utils');

module.exports = function(cacheFile) {
  var isEnabled = $.isFile(cacheFile);

  var cache = isEnabled
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
    save: function() {
      if (isEnabled) {
        $.writeJSON(cacheFile, cache);
      }
    }
  };
};
