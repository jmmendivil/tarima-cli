// https://github.com/shakyShane/bs-fullscreen-message

(function (socket) {
  var body = document.getElementsByTagName('body')[0],
      rootEl = document.createElement('div');

  rootEl.style.display = 'none';
  rootEl.style.padding = '10px';
  rootEl.style.position = 'fixed';
  rootEl.style.background = '#CC1C22';
  rootEl.style.top = rootEl.style.right = rootEl.style.bottom = rootEl.style.left = 0;

  body.appendChild(rootEl);

  socket.on('bs:notify', function(message) {
    rootEl.style.display = 'block';
    rootEl.innerHTML = [
      '<div style="padding:10px;border:1px dashed #090707;overflow:auto;color:#FFF6D0">',
      '<pre style="white-space:pre;margin:0">' + message + '</pre></div>'
    ].join('');
  });
})(window.___browserSync___.socket);
