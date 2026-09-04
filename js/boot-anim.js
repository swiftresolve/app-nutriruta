// El punto y el trazo verde del splash de arranque se calculan juntos,
// frame a frame, a partir del mismo progreso (0..1) -- el punto no "sigue"
// al trazo, su posición ES lo que se usa para decidir cuánto verde se ve.
// Mismos tiempos (0/55/70/100%) y misma curva ease-in-out que tenía antes
// el @keyframes boot-draw, para no cambiar cómo se ve la línea dibujándose.
(function () {
  var dr = document.getElementById('bootDrawPath');
  var path = document.getElementById('bootRoutePath');
  var dot = document.getElementById('bootTraveler');
  if (!dr || !path || !dot) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    dr.style.strokeDashoffset = '0';
    return;
  }
  var total = path.getTotalLength();
  var DUR = 1700;
  function cubicBezier(x1, y1, x2, y2) {
    function A(a1, a2) { return 1 - 3 * a2 + 3 * a1; }
    function B(a1, a2) { return 3 * a2 - 6 * a1; }
    function C(a1) { return 3 * a1; }
    function bezX(t) { return ((A(x1, x2) * t + B(x1, x2)) * t + C(x1)) * t; }
    function bezY(t) { return ((A(y1, y2) * t + B(y1, y2)) * t + C(y1)) * t; }
    function bezXd(t) { return 3 * A(x1, x2) * t * t + 2 * B(x1, x2) * t + C(x1); }
    return function (x) {
      var t = x;
      for (var i = 0; i < 6; i++) {
        var dd = bezXd(t);
        if (Math.abs(dd) < 1e-6) break;
        t -= (bezX(t) - x) / dd;
      }
      return bezY(t);
    };
  }
  var ease = cubicBezier(0.42, 0, 0.58, 1);
  var start = null;
  var raf = null;
  function tick(ts) {
    if (!document.getElementById('bootDrawPath')) { cancelAnimationFrame(raf); return; }
    if (start === null) start = ts;
    var t = ((ts - start) % DUR) / DUR;
    if (t < 0.55) {
      var p = ease(t / 0.55);
      dr.style.strokeDashoffset = String(100 - 100 * p);
      var pt = path.getPointAtLength(p * total);
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
      dot.style.opacity = String(Math.min(1, t / 0.55 * 12));
    } else if (t < 0.70) {
      dr.style.strokeDashoffset = '0';
      dot.style.opacity = String(Math.max(0, 1 - (t - 0.55) / 0.15 * 3));
    } else {
      var q = ease((t - 0.70) / 0.30);
      dr.style.strokeDashoffset = String(-100 * q);
      dot.style.opacity = '0';
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
})();
