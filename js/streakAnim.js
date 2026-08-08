// Animación decorativa (no bloqueante) al sumar un día nuevo a la racha.
// Se autodestruye sola; no requiere interacción ni pausa el resto de la app
// (el checklist de "cómo vas" invasivo ya se rehizo una vez por esto mismo —
// esta celebración nunca debe convertirse en un modal que haya que cerrar).
//
// stats (opcional): { habitos, totalHabitos, vasos, meta } — cuando se
// pasa, la celebración se convierte en un pequeño "recibo" del día en
// chips de colores (inspirado en la pantalla de fin de lección de
// Duolingo: EXP / precisión / ritmo, cada una en su propia caja).
import { broteStage, broteBadge } from './ruti.js';

const CONFETI = ['#2BB5A0', '#FF8A6B', '#6FA8DC', '#FFD86B'];

// Llamita de hielo (racha "congelada" por una Pausa de Ruta) — mismo
// espíritu visual que el streak freeze de Duolingo: cristal celeste con
// una gota más oscura al centro y dos destellos, en vez de la llama
// naranja normal, para el día que quedó cubierto en vez de roto.
export function frozenFlameIcon(size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 36" aria-hidden="true">
    <path d="M16 2 C22 8 27 14 27 21 C27 28.5 22 33 16 33 C10 33 5 28.5 5 21 C5 14 10 8 16 2 Z"
      fill="#8FD3F4"/>
    <path d="M16 2 C22 8 27 14 27 21 C27 28.5 22 33 16 33 L16 2 Z" fill="#4FB3E8"/>
    <path d="M16 12 C19.5 16 21.5 19 21.5 22.5 C21.5 26.5 19 29 16 29 C13 29 10.5 26.5 10.5 22.5 C10.5 19 12.5 16 16 12 Z" fill="#2E9BDB"/>
    <rect x="9" y="15" width="4.4" height="4.4" fill="#fff" opacity="0.9" transform="rotate(45 11.2 17.2)"/>
    <rect x="19.5" y="21" width="3.2" height="3.2" fill="#fff" opacity="0.85" transform="rotate(45 21.1 22.6)"/>
    <path d="M11 31 Q11 34.5 13.2 34.5 Q13.2 32 11 31 Z" fill="#4FB3E8"/>
    <path d="M20 31.5 Q20 34.5 21.8 34.5 Q21.8 32.3 20 31.5 Z" fill="#4FB3E8"/>
  </svg>`;
}

export function celebrateStreak(n, stats) {
  if (document.querySelector('.streak-celebrate')) return; // ya hay una en curso
  vibrate([30, 40, 30]);
  const el = document.createElement('div');
  el.className = 'streak-celebrate';
  el.setAttribute('aria-live', 'polite');
  const etapa = broteStage(n);
  const resumen = stats
    ? `<div class="streak-resumen">
        <span class="streak-chip chip-a">✅ ${stats.habitos}/${stats.totalHabitos}<em>hábitos</em></span>
        <span class="streak-chip chip-b">💧 ${stats.vasos}/${stats.meta}<em>vasos</em></span>
        <span class="streak-chip chip-c">🔥 ${n}<em>en Ruta</em></span>
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
    <div class="flame-big">${broteBadge(etapa, { size: 72 })}</div>
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
