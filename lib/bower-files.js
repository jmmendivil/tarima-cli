var $ = require('./utils');

var path = require('path');

var mainFiles = require($.resolve('main-bower-files'));

module.exports = function() {
  var publicDir = path.join(this.opts.src, 'public');

  var code = mainFiles().map(function(file) {
    return $.read(file);
  }).join('\n;');

  $.write(path.join(publicDir, 'vendor', 'all.js'), code);
};
