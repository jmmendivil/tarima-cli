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
  hint: '∙'
};

function style(message) {
  return message.replace(/\{([.\w]+)\|([^{}]+)\}/g, function() {
    var colors = arguments[1],
        msg = arguments[2];

    var colorized = clc,
        segments = colors.split('.');

    var depth = 8;

    while (segments.length) {
      var key = segments.shift();

      if (key === 'pad') {
        msg = (new Array(depth - msg.length + 1)).join(' ') + msg;
        continue;
      }

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

    var ok = this.isEnabled();

    var src = out.src,
        dest = path.relative(process.cwd(), out.dest);

    if (src) {
      if (Array.isArray(src)) {
        src = '[' + src.length + ' file' + (src.length !== 1 ? 's' : '') + ']';
      } else {
        src = path.relative(process.cwd(), out.src);
      }

      if (ok) {
        this.printf('\r  {pad.blackBright|%s} {pending.yellow|%s}', type, src);
      }
    }

    var err;

    try {
      cb();
    } catch (e) {
      err = e;
    }

    if (ok) {
      if (err) {
        this.printf('\r  {pad.blackBright|%s} {err.red|%s}', type, src || dest);
        this.writeln(err);
      } else {
        this.printf('\r  {pad.blackBright|%s} {ok.green|%s}', type, dest);
      }

      write(clc.erase.lineRight + '\n');
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
      INFO: log('blackBright', '#', 1),
      DEBUG: log('cyan', '»', 2),
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
