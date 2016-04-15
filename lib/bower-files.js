var $ = require('./utils');

var path = require('path');

var mainFiles = require($.resolve('main-bower-files'));

module.exports = function() {
  var code = mainFiles().map(function(file) {
    return $.read(file);
  }).join('\n;');

  $.write(path.join(this.opts.public, 'vendor', 'all.js'), code);
};
