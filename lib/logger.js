var $ = require('./utils');

var clc = require('cli-color');

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
  status: function(input, show, cb) {
    var begin;

    if (show) {
      begin = new Date();
    }

    var printf = this.printf,
        writeln = this.writeln;

    var hasLogs = current > 0;

    if (hasLogs && (begin || !show)) {
      printf('\r{pending.yellow|%s ...}', input);
      printf(clc.erase.lineRight);
      printf('\r');
    }

    cb(function(err, done, output) {
      var end;

      if (begin) {
        end = $.timeDiff(begin);
      }

      if (err) {
        if (hasLogs) {
          printf('\r{err.red|%s} {blackBright|%s}', input, end);
          printf(clc.erase.lineRight);
          writeln();
        }

        return done(err);
      }

      done();

      // update
      if (begin) {
        end = $.timeDiff(begin);
      }

      if (output) {
        if (hasLogs && end) {
          printf('\r{ok.green|%s} {blackBright|%s}', output, end);
          printf(clc.erase.lineRight);
          printf('\n');
        }

        if (!show && hasLogs) {
          printf('\r{ok.green|%s}', output);
          printf(clc.erase.lineRight);
          printf('\r');
        }
      }
    });
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
