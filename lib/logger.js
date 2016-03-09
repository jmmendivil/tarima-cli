var clc = require('cli-color');

var print = process.stdout.write.bind(process.stdout);

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

function puts(message) {
  var args = Array.prototype.slice.call(arguments, 1);

  return message.replace(/%s/g, function() {
    return args.shift();
  });
}

function log(type, symbol) {
  return function() {
    print(clc.erase.line);
    print(clc.move.left(clc.windowSize.width));
    print(style('{' + type + '|' + symbol + ' ' + puts.apply(null, arguments) + '}'));
  };
}

module.exports = {
  pending: log('yellow', '↺'),
  legend: log('cyan', '⚡'),
  ok: log('green', '✓'),
  err: log('red', '✗'),
  info: log('blue', '#'),
  debug: log('blackBright', '#'),
  verbose: log('magenta', '#'),
  writeln: function() {
    print(puts.apply(null, arguments) + '\n');
  }
};
