// Insignias de puntualidad -- una sola forma de escudo (a diferencia de
// Huawei Health, que usa una silueta distinta por categoría) pero con
// tratamiento metálico real por nivel: gradiente, bisel y brillo, más un
// ícono propio de cada comida grabado en el centro -- para que se sientan
// como una insignia de verdad, no un emoji dentro de un círculo plano.
// Ver evaluarPuntualidad()/UMBRALES_PUNTUALIDAD en store.js para la lógica
// de cuándo se gana cada una.

const PALETAS = {
  bronce: { claro: '#d99a63', medio: '#a5652f', oscuro: '#5c3a1f', anillo: '#c98a52', texto: '#fff' },
  plata: { claro: '#f3f5f7', medio: '#c3c8cf', oscuro: '#82868d', anillo: '#dfe2e6', texto: '#3a3d40' },
  oro: { claro: '#ffe28a', medio: '#e2b23a', oscuro: '#a9791a', anillo: '#f0cb63', texto: '#4a3403' },
  diamante: { claro: '#eafdff', medio: '#7fd8e8', oscuro: '#2f97ac', anillo: '#a9e8f2', texto: '#0d3d46' }
};
const BLOQUEADA = { claro: '#8a948d', medio: '#6b756e', oscuro: '#454d47', anillo: '#7a847d', texto: '#c9cfca' };

export const NOMBRE_TIER = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro', diamante: 'Diamante' };

// Íconos simples y reconocibles por comida, centrados en (0,0), pensados
// para leerse bien a ~26px dentro del escudo -- formas geométricas, no
// ilustraciones detalladas (se pierden a ese tamaño).
const ICONOS = {
  // Sol: círculo + 8 rayos cortos.
  desayuno: `<g stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
    <circle r="8" fill="currentColor" stroke="none"/>
    <line x1="0" y1="-15" x2="0" y2="-11"/><line x1="0" y1="15" x2="0" y2="11"/>
    <line x1="-15" y1="0" x2="-11" y2="0"/><line x1="15" y1="0" x2="11" y2="0"/>
    <line x1="-10.6" y1="-10.6" x2="-7.8" y2="-7.8"/><line x1="10.6" y1="10.6" x2="7.8" y2="7.8"/>
    <line x1="-10.6" y1="10.6" x2="-7.8" y2="7.8"/><line x1="10.6" y1="-10.6" x2="7.8" y2="-7.8"/>
  </g>`,
  // Manzana: dos lóbulos + tallo + hoja.
  media_manana: `<g fill="currentColor">
    <path d="M0,-6 C7,-10 14,-4 13,4 C12,12 5,16 0,13 C-5,16 -12,12 -13,4 C-14,-4 -7,-10 0,-6 Z"/>
    <rect x="-1.4" y="-13" width="2.8" height="7" rx="1.2"/>
    <path d="M1 -10 C6 -13 9 -9 6 -6 C4 -8 2 -9 1 -10 Z"/>
  </g>`,
  // Tenedor y cuchillo cruzados -- más claro que un plato a este tamaño
  // (un círculo con una cuña adentro se leía como un reloj, no comida).
  almuerzo: `<g stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none" transform="rotate(45)">
    <line x1="-7" y1="-15" x2="-7" y2="15"/>
    <path d="M-10,-15 V-6 a3,3 0 0 0 6,0 V-15"/>
    <path d="M7,-15 C7,-8 10,-8 10,-2 C10,2 7,3 7,6 V15"/>
  </g>`,
  // Taza: cuerpo trapezoidal + asa + vapor.
  media_tarde: `<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
    <path d="M-10,-4 L-8,12 A2,2 0 0 0 -6,14 H6 A2,2 0 0 0 8,12 L10,-4 Z" fill="currentColor" stroke="none"/>
    <path d="M10,-1 C16,-1 16,7 10,7" />
    <path d="M-4,-10 C-6,-8 -2,-7 -4,-5" />
    <path d="M2,-10 C0,-8 4,-7 2,-5" />
  </g>`,
  // Luna creciente: círculo completo menos otro círculo desplazado
  // (evenodd) -- más confiable que un solo path con dos arcos, que no
  // llegaba a formar la figura (bug real: la insignia quedaba sin ícono).
  cena: `<path fill-rule="evenodd" fill="currentColor" d="M0,-13 A13,13 0 1,0 0,13 A13,13 0 1,0 0,-13 Z M7,-11 A11,11 0 1,0 7,11 A11,11 0 1,0 7,-11 Z"/>`,
  // Maestra: estrella de 5 puntas -- el "todas a la vez" se representa
  // como la insignia más alta/central, no una comida más.
  maestra: `<path fill="currentColor" d="M0,-16 L4.5,-5.5 16,-4.9 7,2.6 9.9,14 0,7.5 -9.9,14 -7,2.6 -16,-4.9 -4.5,-5.5 Z"/>`
};

// Escudo con bisel real: gradiente de 3 paradas (claro/medio/oscuro) da la
// sensación de luz viniendo de arriba-izquierda, más un aro interior más
// claro que simula el filo pulido. bloqueada = silueta plana gris, sin
// brillo -- mismo lenguaje que Huawei para lo que aún no se gana. Sin
// texto adentro (pedido explícito) -- el ícono + el material/color ya
// distinguen la comida y el nivel; el número de días va aparte, como
// etiqueta HTML debajo de la insignia (ver dashboard.js).
export function insigniaSVG({ meal, tier, bloqueada = false, size = 88 }) {
  const p = bloqueada ? BLOQUEADA : (PALETAS[tier] || PALETAS.bronce);
  const icono = ICONOS[meal] || ICONOS.desayuno;
  const gid = `ins-${meal}-${tier}-${bloqueada ? 'b' : 'a'}-${Math.random().toString(36).slice(2, 7)}`;
  return `<svg viewBox="0 0 100 116" width="${size}" height="${Math.round(size * 1.16)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0.9" y2="1">
        <stop offset="0%" stop-color="${p.claro}"/>
        <stop offset="55%" stop-color="${p.medio}"/>
        <stop offset="100%" stop-color="${p.oscuro}"/>
      </linearGradient>
    </defs>
    <path d="M50 3 L93 23 V63 C93 90 74 105 50 113 C26 105 7 90 7 63 V23 Z"
      fill="url(#${gid})" stroke="${p.oscuro}" stroke-width="2"/>
    <path d="M50 9 L86 27 V62 C86 85 70 98 50 105 C30 98 14 85 14 62 V27 Z"
      fill="none" stroke="${p.anillo}" stroke-width="1.4" opacity="0.8"/>
    <g color="${bloqueada ? '#dfe3e0' : '#fff'}" opacity="${bloqueada ? 0.65 : 0.96}" transform="translate(50,58) scale(1.35)">
      ${icono}
    </g>
  </svg>`;
}
