// Animación decorativa (no bloqueante) al sumar un día nuevo a la racha.
// Se autodestruye sola; no requiere interacción ni pausa el resto de la app.
export function celebrateStreak(n) {
  if (document.querySelector('.streak-celebrate')) return; // ya hay una en curso
  const el = document.createElement('div');
  el.className = 'streak-celebrate';
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <div class="ring"></div>
    <div class="flame-big">🔥</div>
    <div class="label">¡${n} día${n === 1 ? '' : 's'} seguido${n === 1 ? '' : 's'}!</div>`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'streak-fade-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 320);
  }, 1400);
}

// Estallido pequeño e inmediato al completar una micro-acción (marcar un
// hábito, un vaso de agua, "Tu paso de hoy"). Vive en <body>, no en el
// elemento que se tocó, porque el dashboard vuelve a pintarse completo justo
// después del clic — si la animación viviera en la fila, se destruiría con
// ella antes de terminar de jugar.
const SPARKS = ['✨', '🌟', '💚', '⭐'];

export function habitCheckPop(x, y) {
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
