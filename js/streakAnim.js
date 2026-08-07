// Animación decorativa (no bloqueante) al sumar un día nuevo a la racha.
// Se autodestruye sola; no requiere interacción ni pausa el resto de la app
// (el checklist de "cómo vas" invasivo ya se rehizo una vez por esto mismo —
// esta celebración nunca debe convertirse en un modal que haya que cerrar).
//
// stats (opcional): { habitos, totalHabitos, vasos, meta } — cuando se
// pasa, la celebración se convierte en un pequeño "recibo" del día en
// chips de colores (inspirado en la pantalla de fin de lección de
// Duolingo: EXP / precisión / ritmo, cada una en su propia caja).
import { growthStage, rutiBadge } from './ruti.js';

const CONFETI = ['#2BB5A0', '#FF8A6B', '#6FA8DC', '#FFD86B'];

export function celebrateStreak(n, stats) {
  if (document.querySelector('.streak-celebrate')) return; // ya hay una en curso
  vibrate([30, 40, 30]);
  const el = document.createElement('div');
  el.className = 'streak-celebrate';
  el.setAttribute('aria-live', 'polite');
  const etapa = growthStage(n);
  const resumen = stats
    ? `<div class="streak-resumen">
        <span class="streak-chip chip-a">✅ ${stats.habitos}/${stats.totalHabitos}<em>hábitos</em></span>
        <span class="streak-chip chip-b">💧 ${stats.vasos}/${stats.meta}<em>vasos</em></span>
        <span class="streak-chip chip-c">🔥 ${n}<em>racha</em></span>
      </div>`
    : '';
  const confeti = stats
    ? Array.from({ length: 14 }, (_, i) => {
        const left = 8 + Math.random() * 84;
        const delay = (Math.random() * 0.25).toFixed(2);
        const color = CONFETI[i % CONFETI.length];
        return `<span class="confeti-bit" style="left:${left}%; background:${color}; animation-delay:${delay}s"></span>`;
      }).join('')
    : '';
  el.innerHTML = `
    <div class="ring"></div>
    ${confeti}
    <div class="flame-big">${rutiBadge(etapa, { size: 72 })}</div>
    <div class="label${stats ? ' wrap' : ''}">¡${n} día${n === 1 ? '' : 's'} seguido${n === 1 ? '' : 's'}!${resumen}</div>`;
  document.body.appendChild(el);
  const duracion = stats ? 2600 : 1400;
  setTimeout(() => {
    el.style.animation = 'streak-fade-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 320);
  }, duracion);
}

// Checkpoint de la Misión 12 semanas / Plan de 7 días: mismo confeti que
// celebrateStreak, pero con una insignia de medalla en vez de Ruti — es un
// hito de tramo completado, no de racha diaria.
export function celebrateMilestone(titulo, subtitulo) {
  if (document.querySelector('.streak-celebrate')) return;
  vibrate([25, 35, 25, 35, 60]);
  const el = document.createElement('div');
  el.className = 'streak-celebrate';
  el.setAttribute('aria-live', 'polite');
  const confeti = Array.from({ length: 18 }, (_, i) => {
    const left = 6 + Math.random() * 88;
    const delay = (Math.random() * 0.3).toFixed(2);
    const color = CONFETI[i % CONFETI.length];
    return `<span class="confeti-bit" style="left:${left}%; background:${color}; animation-delay:${delay}s"></span>`;
  }).join('');
  el.innerHTML = `
    <div class="ring"></div>
    ${confeti}
    <div class="flame-big"><div class="milestone-badge">🏅</div></div>
    <div class="label wrap">${titulo}${subtitulo ? `<div class="small muted mt" style="margin-top:4px">${subtitulo}</div>` : ''}</div>`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'streak-fade-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 320);
  }, 2800);
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
