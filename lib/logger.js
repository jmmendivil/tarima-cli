var $ = require('./utils');

var clc = require('cli-color'),
    path = require('path');

var write = process.stdout.write.bind(process.stdout);

var levels = [0, 'info', 'debug', 'verbose'],
    current = 0;

var symbols = {
  pending: '↺',
  ok: '✓',
  err: '✗',
  diff: '≠',
  hint: '∙',
  info: '#'
};

function style(message) {
  return message.replace(/\{([.\w]+)\|([^{}]+)\}/g, function() {
    var colors = arguments[1],
        msg = arguments[2];

    var colorized = clc,
        segments = colors.split('.');

    while (segments.length) {
      var key = segments.shift();

      if (symbols[key]) {
        msg = symbols[key] + ' ' + msg;
        continue;
      }

      if (!colorized[key]) {
        break;
      }

      colorized = colorized[key];
    }

    return colorized(msg);
  });
}

function puts(message) {
  var args = Array.prototype.slice.call(arguments, 1);

  return message ? message.replace(/%s/g, function() {
    return args.shift();
  }) : '';
}

function log(type, symbol, allowed) {
  return function() {
    if ((allowed - 1) < current) {
      write(style('{' + type + '|' + symbol + ' '
        + puts.apply(null, arguments) + '}'));
    }

    return this;
  };
}

module.exports = {
  status: function(type, out, cb) {
    if (typeof type === 'object') {
      cb = out;
      out = type;
      type = out.type || 'unknown';
    }

    var begin = +new Date();

    var src = out.src,
        dest = path.relative(process.cwd(), out.dest);

    if (src) {
      if (Array.isArray(src)) {
        src = 'bunch of files';
      } else {
        src = path.relative(process.cwd(), out.src);
      }

      this.printf('\r{pending.yellow|%s ...}', src);
    }

    var err;

    try {
      cb();
    } catch (e) {
      err = e;
    }

    var end = $.timeDiff(begin);

    if (err) {
      this.printf('\r{err.red|%s} {blackBright|%s}\n', src || dest, end);
      this.writeln(err);
    } else {
      this.printf('\r{ok.green|%s} {blackBright|%s}\n', dest, end);
    }
  },
  printf: function() {
    write(style(puts.apply(null, arguments)));
  },
  writeln: function() {
    write(puts.apply(null, arguments) + '\n');
  },
  setLevel: function(type) {
    current = typeof type !== 'number' ? levels.indexOf(type) : type;
  },
  getLogger: function() {
    return {
      INFO: log('cyan', '#', 1),
      DEBUG: log('blackBright', '»', 2),
      VERBOSE: log('magenta', '→', 3),
    };
  },
  isEnabled: function() {
    return current > 0;
  },
  isDebug: function() {
    return current > 1;
  }
};
