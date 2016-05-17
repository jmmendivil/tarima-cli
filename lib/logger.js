var clc = require('cli-color');

var write = process.stdout.write.bind(process.stdout);

var levels = [0, 'info', 'debug', 'verbose'],
    current = 0;

var symbols = {
  ok: '✔',
  not: '✗',
  err: '✖',
  log: '#',
  diff: '≠',
  warn: '⚠',
  info: 'ℹ',
  hint: '→',
  wait: '↺'
};

var styles = {
  delete: 'ok.red',
  error: 'err.red'
};

function style(message) {
  return message.replace(/\{([.\w]+)\|(.+?)\}(?=\s|$)/g, function(_, format, message) {
    var colorized = clc,
        segments = format.split('.');

    var depth = 8;

    while (segments.length) {
      var key = segments.shift();

      if (key === 'pad') {
        message = (new Array(depth - message.length + 1)).join(' ') + message;
        continue;
      }

      if (symbols[key]) {
        message = symbols[key] + ' ' + message;
        continue;
      }

      if (!colorized[key]) {
        break;
      }

      colorized = colorized[key];
    }

    return colorized(message);
  }).replace(/`(.+?)`/g, function(expression) {
    return clc.yellow(expression);
  });
}

function puts(message) {
  var args = Array.prototype.slice.call(arguments, 1);

  return String(message).replace(/%s/g, function() {
    return args.shift();
  });
}

function log(allowed, color) {
  return function() {
    if ((allowed - 1) < current) {
      write('\r' + clc[color](style(puts.apply(null, arguments))) + '\n');
    }

    return this;
  };
}

module.exports = {
  erase: function(type, suffix) {
    write(clc.erase[type] + (suffix || ''));
  },
  status: function(type, out, cb) {
    if (typeof type === 'object') {
      cb = out;
      out = type;
      type = out.type || 'unknown';
    }

    var ok = this.isEnabled();

    var src = out.src || out,
        dest = out.dest || out;

    if (src) {
      if (Array.isArray(src)) {
        src = '[' + src.length + ' file' + (src.length !== 1 ? 's' : '') + ']';
      } else {
        src = out.src || out;
      }

      if (ok) {
        this.printf('\r  {pad.blackBright|%s} {wait.blackBright|%s}', type, src);
      }
    }

    var err;

    try {
      if (cb) {
        cb();
      }
    } catch (e) {
      err = e;
    }

    if (ok) {
      if (err) {
        this.printf('\r  {pad.blackBright|%s} {err.red|%s}', type, src || dest);
        this.writeln(err);
      } else {
        this.printf('\r  {pad.blackBright|%s} {%s|%s}', type, styles[type] || 'ok.green', dest);
      }

      write(clc.erase.lineRight + '\n');
    }
  },
  printf: function() {
    write(style(puts.apply(null, arguments)));
  },
  writeln: function() {
    write('\r' + puts.apply(null, arguments) + '\n');
  },
  setLevel: function(type) {
    current = typeof type !== 'number' ? levels.indexOf(type) : type;
  },
  getLogger: function() {
    return {
      INFO: log(1, 'blackBright'),
      DEBUG: log(2, 'cyan'),
      VERBOSE: log(3, 'magenta')
    };
  },
  isEnabled: function() {
    return current > 0;
  },
  isDebug: function() {
    return current > 1;
  }
};
