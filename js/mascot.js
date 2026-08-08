// Ruti: la nutria exploradora de NutriRuta — compañera del usuario, distinta
// del Brote de Ruta (ver ruti.js, la planta que crece con la constancia).
// Cuerpo entero de pie (cabeza, orejas, ojos grandes, hocico claro, cola
// plana), inspirado en referencia de nutria de dibujos animados: mismo
// lenguaje simple y expresivo que usa Duolingo con Duo, no un badge plano.
// Sin dependencias propias, para poder importarse desde header, quiz y
// celebraciones sin crear ciclos con app.js/store.js.

const CARA = {
  // Curiosa: cejas en ángulo, ojos bien abiertos, boca pequeña en "o".
  curiosa: {
    cejas: `<path d="M40 46 Q48 40 56 44" stroke="#4A3220" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M64 44 Q72 40 80 46" stroke="#4A3220" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    ojos: `<circle cx="47" cy="58" r="9" fill="#fff"/><circle cx="73" cy="58" r="9" fill="#fff"/>
      <circle cx="48" cy="59" r="4.6" fill="#2A1B10"/><circle cx="72" cy="59" r="4.6" fill="#2A1B10"/>
      <circle cx="46" cy="56.5" r="1.6" fill="#fff"/><circle cx="70" cy="56.5" r="1.6" fill="#fff"/>`,
    boca: `<ellipse cx="60" cy="78" rx="4" ry="3.6" fill="#7A4A2E"/>`
  },
  // Feliz: cejas relajadas arriba, ojos sonrientes, boca abierta + destello.
  feliz: {
    cejas: `<path d="M40 45 Q48 41 56 43" stroke="#4A3220" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M64 43 Q72 41 80 45" stroke="#4A3220" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    ojos: `<circle cx="47" cy="58" r="9" fill="#fff"/><circle cx="73" cy="58" r="9" fill="#fff"/>
      <circle cx="48" cy="59" r="4.6" fill="#2A1B10"/><circle cx="72" cy="59" r="4.6" fill="#2A1B10"/>
      <circle cx="46" cy="56.5" r="1.6" fill="#fff"/><circle cx="70" cy="56.5" r="1.6" fill="#fff"/>
      <path d="M100 34 l2.5 6.4 6.4 2.5 -6.4 2.5 -2.5 6.4 -2.5-6.4 -6.4-2.5 6.4-2.5z" fill="#FFD86B"/>`,
    boca: `<path d="M50 76 Q60 88 70 76 Q60 82 50 76 Z" fill="#7A3B2E"/><path d="M55 78 Q60 82 65 78" stroke="#E8768C" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
  },
  // Tranquila: ojos entrecerrados, sonrisa suave — SOS y descanso.
  tranquila: {
    cejas: '',
    ojos: `<path d="M39 58 Q47 62 55 58" stroke="#2A1B10" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      <path d="M65 58 Q73 62 81 58" stroke="#2A1B10" stroke-width="3.6" fill="none" stroke-linecap="round"/>`,
    boca: `<path d="M52 78 Q60 84 68 78" stroke="#7A4A2E" stroke-width="3" fill="none" stroke-linecap="round"/>`
  },
  // Saludo: misma cara feliz; lo que cambia es el brazo (saluda).
  saludo: {
    cejas: `<path d="M40 45 Q48 41 56 43" stroke="#4A3220" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M64 43 Q72 41 80 45" stroke="#4A3220" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    ojos: `<circle cx="47" cy="58" r="9" fill="#fff"/><circle cx="73" cy="58" r="9" fill="#fff"/>
      <circle cx="48" cy="59" r="4.6" fill="#2A1B10"/><circle cx="72" cy="59" r="4.6" fill="#2A1B10"/>
      <circle cx="46" cy="56.5" r="1.6" fill="#fff"/><circle cx="70" cy="56.5" r="1.6" fill="#fff"/>`,
    boca: `<path d="M50 76 Q60 88 70 76 Q60 82 50 76 Z" fill="#7A3B2E"/>`
  }
};

// mood: 'curiosa' | 'feliz' | 'tranquila' | 'saludo' (saluda con la mano)
export function rutiMascot(mood = 'curiosa', { size = 64, animated = true } = {}) {
  const c = CARA[mood] || CARA.curiosa;
  const saluda = mood === 'saludo';
  const cls = `ruti-mascot${animated ? ' animated' : ''}`;
  return `<div class="${cls}" style="width:${size}px;height:${size}px" role="img" aria-label="Ruti, tu nutria exploradora">
    <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="142" rx="26" ry="5" fill="#000" opacity="0.06"/>
      <!-- cola -->
      <path d="M84 108 Q112 106 116 128 Q118 142 96 138 Q104 122 84 118 Z" fill="#8C6239"/>
      <!-- brazo trasero / cuerpo -->
      <path d="M40 118 Q26 112 24 96 Q23 84 34 82 Q34 100 46 112 Z" fill="#8C6239"/>
      <!-- cuerpo -->
      <path d="M60 84 C40 84 32 104 34 120 C36 134 46 140 60 140 C74 140 84 134 86 120 C88 104 80 84 60 84 Z" fill="#8C6239"/>
      <ellipse cx="60" cy="116" rx="19" ry="21" fill="#E8C9A3"/>
      <!-- pies -->
      <ellipse cx="47" cy="140" rx="10" ry="6" fill="#6E4A28"/>
      <ellipse cx="73" cy="140" rx="10" ry="6" fill="#6E4A28"/>
      ${saluda
        ? `<path d="M78 92 Q100 78 98 58 Q97 50 90 52 Q92 68 74 84 Z" fill="#8C6239"/>`
        : `<path d="M80 96 Q96 96 98 112 Q99 122 90 122 Q88 108 76 104 Z" fill="#8C6239"/>`}
      <!-- cabeza -->
      <circle cx="26" cy="42" r="11" fill="#8C6239"/>
      <circle cx="94" cy="42" r="11" fill="#8C6239"/>
      <circle cx="26" cy="43" r="5.5" fill="#6E4A28"/>
      <circle cx="94" cy="43" r="5.5" fill="#6E4A28"/>
      <circle cx="60" cy="54" r="38" fill="#A67947"/>
      <ellipse cx="60" cy="68" rx="24" ry="20" fill="#E8C9A3"/>
      ${c.cejas}
      ${c.ojos}
      <ellipse cx="60" cy="68" rx="3.4" ry="2.8" fill="#4A3220"/>
      ${c.boca}
      <path d="M40 68 l-13 -2M39 73 l-14 3M41 63 l-12 -6" stroke="#C9A876" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M80 68 l13 -2M81 73 l14 3M79 63 l12 -6" stroke="#C9A876" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    </svg>
  </div>`;
}
