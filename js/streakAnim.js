// Animación decorativa (no bloqueante) al sumar un día nuevo a la racha.
// Se autodestruye sola; no requiere interacción ni pausa el resto de la app.
//
// stats (opcional): { habitos, totalHabitos, vasos, meta } — cuando se
// pasa, la celebración se convierte en un pequeño "recibo" del día
// (cuántos hábitos, cuánta agua), no solo el número de racha.
export function celebrateStreak(n, stats) {
  if (document.querySelector('.streak-celebrate')) return; // ya hay una en curso
  vibrate([30, 40, 30]);
  const el = document.createElement('div');
  el.className = 'streak-celebrate';
  el.setAttribute('aria-live', 'polite');
  const resumen = stats
    ? `<div class="streak-resumen"><span>✅ ${stats.habitos}/${stats.totalHabitos} hábitos</span><span>💧 ${stats.vasos}/${stats.meta} vasos</span></div>`
    : '';
  el.innerHTML = `
    <div class="ring"></div>
    <div class="flame-big">🔥</div>
    <div class="label${stats ? ' wrap' : ''}">¡${n} día${n === 1 ? '' : 's'} seguido${n === 1 ? '' : 's'}!${resumen}</div>`;
  document.body.appendChild(el);
  const duracion = stats ? 2400 : 1400;
  setTimeout(() => {
    el.style.animation = 'streak-fade-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 320);
  }, duracion);
}

// Estallido pequeño e inmediato al completar una micro-acción (marcar un
// hábito, un vaso de agua, "Tu paso de hoy"). Vive en <body>, no en el
// elemento que se tocó, porque el dashboard vuelve a pintarse completo justo
// después del clic — si la animación viviera en la fila, se destruiría con
// ella antes de terminar de jugar.
const SPARKS = ['✨', '🌟', '💚', '⭐'];

export function habitCheckPop(x, y) {
  vibrate(15);
  // Tope de seguridad: si alguien toca varias cosas muy rápido, no acumular
  // decenas de estos elementos flotando.
  if (document.querySelectorAll('.habit-pop').length >= 5) return;
  const el = document.createElement('div');
  el.className = 'habit-pop';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  const sparks = Array.from({ length: 4 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 4 + Math.random() * 0.4;
    const dist = 24 + Math.random() * 10;
    const dx = (Math.cos(angle) * dist).toFixed(1);
    const dy = (Math.sin(angle) * dist).toFixed(1);
    return `<span class="spark" style="--dx:${dx}px;--dy:${dy}px">${SPARKS[i % SPARKS.length]}</span>`;
  }).join('');
  el.innerHTML = `<span class="check">✅</span>${sparks}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

// Vibración táctil corta (Android; iOS Safari no soporta la API y lo
// ignora sin error). Nunca debe romper la interacción real si falla.
export function vibrate(pattern) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    // silencioso
  }
}
