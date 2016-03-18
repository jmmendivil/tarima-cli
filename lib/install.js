var $ = require('./utils');

var logger = require('./logger');

var npm;

function install(dep, cb) {
  var start = new Date();

  logger.printf('{info.cyan|npm} install %s\n', dep);

  npm.commands.install($.resolve.baseDir, [dep], function(err) {
    logger.printf('{info.cyan|npm} done in %s\n', $.timeDiff(start));
    cb(err);
  });
}

module.exports = function(dep) {
  return function(next) {
    /* istanbul ignore if */
    if ($.resolve(dep.split('@')[0], false)) {
      return next();
    }

    npm = npm || require($.resolve('npm'));

    npm.load({
      loaded: false,
      progress: false,
      loglevel: 'silent',
      forceInstall: true
    }, function(err) {
      /* istanbul ignore else */
      if (!err) {
        install(dep, next);
      } else {
        next(err);
      }
    });
  };
};
