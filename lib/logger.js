var clc = require('cli-color');

var write = process.stdout.write.bind(process.stdout);

var levels = [0, 'info', 'debug', 'verbose'],
    current;

var logger;

function style(message) {
  return message.replace(/\{([.\w]+)\|([^{}]+)\}/g, function() {
    var colors = arguments[1],
        msg = arguments[2];

    var colorized = clc,
        segments = colors.split('.');

    while (segments.length) {
      var key = segments.shift();

      if (!colorized[key]) {
        break
      }

      colorized = colorized[key]
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
      print(style('{' + type + '|' + symbol + ' ' + puts.apply(null, arguments) + '}'), true);
    }
  };
}

module.exports = {
  PENDING: log('yellowBright', '↺', 0),
  SUCCESS: log('green', '✓', 0),
  FAILURE: log('redBright', '✗', 0),
  INFO: log('greenBright', '∙', 0),
  WARN: log('yellow', '∙', 0),
  HINT: log('cyan', '∙', 0),
  DEBUG: log('blackBright', '»', 1),
  ERROR: log('red', '→', 2),
  write: function() {
    print(puts.apply(null, arguments));
  },
  writeln: function() {
    print(puts.apply(null, arguments) + '\n', true);
  },
  setLevel: function(type) {
    current = typeof type !== 'number' ? levels.indexOf(type) : type;
  }
};
