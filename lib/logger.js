var clc = require('cli-color');

var write = process.stdout.write.bind(process.stdout);

var levels = [0, 'info', 'debug', 'verbose'],
    current;

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

function print(message, clear) {
  if (clear) {
    write(clc.erase.line);
    write(clc.move.left(clc.windowSize.width));
  }

  write(message);
}

function puts(message) {
  var args = Array.prototype.slice.call(arguments, 1);

  return message ? message.replace(/%s/g, function() {
    return args.shift();
  }) : '';
}

function log(type, symbol, allowed) {
  return function() {
    if (allowed < current) {
      print(style('{' + type + '|' + symbol + ' '
        + puts.apply(null, arguments) + '}'), true);
    }
  };
}

module.exports = {
  INFO: log('cyan', '#', 0),
  DEBUG: log('blackBright', '»', 1),
  VERBOSE: log('magenta', '→', 2),
  printf: function() {
    print(style(puts.apply(null, arguments)), true);
  },
  writeln: function() {
    print(puts.apply(null, arguments) + '\n');
  },
  setLevel: function(type) {
    current = typeof type !== 'number' ? levels.indexOf(type) : type;
  }
};
