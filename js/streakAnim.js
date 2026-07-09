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
