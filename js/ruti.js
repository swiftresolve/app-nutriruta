// Brote de Ruta: la plantita que crece con la constancia — separada de Ruti
// (la mascota-nutria, ver mascot.js). Antes este archivo mezclaba ambos
// conceptos; ahora Ruti y el usuario "cuidan juntos" este brote, no lo son.
// Sin dependencias propias (ni de app.js ni de store.js) para que tanto el
// header como progress.js puedan importarlo sin crear un ciclo.

// Mismos umbrales que los logros racha_3/7/30 — no se inventa un número
// nuevo de "hábito consolidado" (ver memoria "solo info comprobada").
export function broteStage(n) {
  if (n >= 30) return { key: 'floreciendo', emoji: '🌸', label: 'Floreciendo' };
  if (n >= 7) return { key: 'creciendo', emoji: '🌿', label: 'Creciendo fuerte' };
  if (n >= 3) return { key: 'brote', emoji: '🌱', label: 'Primeros brotes' };
  return { key: 'semilla', emoji: '🌰', label: 'Sembrando' };
}

// Insignia circular del Brote de Ruta: mismo emoji que ya se usa en
// logros, como personaje (fondo degradado propio de la etapa + leve
// balanceo). premium=true le da el "glow" dorado (versión especial — como
// el Duo iridiscente de Súper Duolingo).
export function broteBadge(etapa, { size = 52, premium = false } = {}) {
  const cls = `ruti-avatar stage-${etapa.key}${premium ? ' premium' : ''}`;
  return `<div class="${cls}" style="width:${size}px;height:${size}px;font-size:${(size * 0.5).toFixed(0)}px" aria-hidden="true">${etapa.emoji}</div>`;
}
