// https://gist.github.com/muhqu/6363127

function commonPrefix(a, b) {
  if (a === b) {
    return a;
  }

  for (var i = 0; a.charAt(i) == b.charAt(i); ++i);

  return a.substring(0, i);
}

function commonSuffix(a, b) {
  if (a === b) {
    return '';
  }

  var i = a.length - 1,
      k = b.length - 1;

  for (var i = a.length - 1, k = b.length - 1; a.charAt(i) == b.charAt(k); --i, --k);

  return a.substring(i + 1, a.length);
}

function renameDiff(a, b) {
  var p = commonPrefix(a, b),
      s = commonSuffix(a, b),
      o = a.substring(p.length, a.length - s.length),
      n = b.substring(p.length, b.length - s.length);

  return [p, o, n, s];
}

function formatRenameDiff(d) {
  var p = d[0],
      o = d[1],
      n = d[2],
      s = d[3];

  if (o === '' && n === '' && s === '') {
    return p;
  }

  return [p, '{ ', o, ' → ', n, ' }', s].join('');
}

module.exports = function(src, dest) {
  return formatRenameDiff(renameDiff(src, dest));
};
