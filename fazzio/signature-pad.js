/** Minimal finger/mouse signature pad. FazzioSignaturePad(canvas) → { clear, isEmpty, toDataURL, onChange }. */
(function () {
  'use strict';

  window.FazzioSignaturePad = function (canvas) {
    var ctx = canvas.getContext('2d');
    var drawing = false;
    var empty = true;
    var last = null;
    var listeners = [];

    function size() {
      var ratio = Math.max(window.devicePixelRatio || 1, 1);
      var rect = canvas.getBoundingClientRect();
      var keep = empty ? null : canvas.toDataURL();
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0d1b2a';
      if (keep) {
        var img = new Image();
        img.onload = function () { ctx.drawImage(img, 0, 0, rect.width, rect.height); };
        img.src = keep;
      }
    }

    function point(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drawing = true;
      last = point(e);
      ctx.beginPath();
      ctx.arc(last.x, last.y, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = '#0d1b2a';
      ctx.fill();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = point(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      if (empty) { empty = false; listeners.forEach(function (fn) { fn(); }); }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
      canvas.addEventListener(t, function () { drawing = false; });
    });
    window.addEventListener('resize', size);
    size();

    return {
      clear: function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        empty = true;
        listeners.forEach(function (fn) { fn(); });
      },
      resize: size,
      isEmpty: function () { return empty; },
      toDataURL: function () { return canvas.toDataURL('image/png'); },
      onChange: function (fn) { listeners.push(fn); },
    };
  };
})();
