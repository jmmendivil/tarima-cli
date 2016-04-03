// https://github.com/shakyShane/bs-fullscreen-message

(function (socket) {
  var body = document.getElementsByTagName('body')[0],
      rootEl;

  socket.on('bs:notify', function(message) {
    if (!rootEl) {
      rootEl = document.createElement('div');

      rootEl.style.padding = '10px';
      rootEl.style.position = 'fixed';
      rootEl.style.background = '#CC1C22';
      rootEl.style.top = rootEl.style.right = rootEl.style.bottom = rootEl.style.left = 0;

      body.appendChild(rootEl);
    }

    rootEl.innerHTML = [
      '<div style="padding:10px;border:1px dashed #090707;overflow:auto;color:#FFF6D0">',
      '<pre style="white-space:pre;margin:0">' + message + '</pre></div>'
    ].join('');
  });

  socket.on('bs:notify:clear', function() {
    body.removeChild(rootEl);
    rootEl = null;
  });
})(window.___browserSync___.socket);