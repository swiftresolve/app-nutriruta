// Liga semanal de gemas: grupos aleatorios de hasta 20 usuarias del mismo
// nivel, ranking por gemas ganadas ESTA semana (state.ligaGemasSemana,
// otorgada donde ya se otorgan gemas -- ver otorgarGemas en store.js).
// Los primeros 6 suben de nivel, los últimos 8 bajan, el resto se queda
// -- la rotación real corre en el servidor cada domingo (liga_rotar_semana,
// cron), acá solo se lee y se pinta. Backend: ver migración
// liga_semanal_gemas y fetchLigaEstado()/fetchMiNivelLiga() en
// supabase-client.js. Diseño de referencia: carrusel de divisiones +
// lista de posiciones de Duolingo (la usuaria mandó capturas), adaptado
// a los 10 niveles propios de NutriRuta (sinónimos de "ruta/camino").
import { esc } from '../store.js';
import { header } from '../app.js';
import { fetchLigaEstado, fetchMiNivelLiga } from '../supabase-client.js';

const NIVELES = [
  null,
  { emoji: '🌱', nombre: 'Sendero' },
  { emoji: '🥾', nombre: 'Trocha' },
  { emoji: '🚶', nombre: 'Vereda' },
  { emoji: '🍃', nombre: 'Senda' },
  { emoji: '🛤️', nombre: 'Camino' },
  { emoji: '🚏', nombre: 'Vía' },
  { emoji: '🧭', nombre: 'Ruta' },
  { emoji: '🎒', nombre: 'Trayecto' },
  { emoji: '⛺', nombre: 'Travesía' },
  { emoji: '🌌', nombre: 'Odisea' }
];
const MEDALLAS = ['🥇', '🥈', '🥉'];
// Cortes fijos (6 suben / 12 se quedan / 20 bajan) pase lo que pase con
// el tamaño real del grupo -- la zona de alguien depende solo de su
// posición, no de cuántas haya en total (ver rellenarConDummies: la
// lista siempre se completa a 20).
const ZONAS = [
  { desde: 0, hasta: 6, label: '⬆️ Suben de nivel' },
  { desde: 6, hasta: 12, label: 'Se quedan' },
  { desde: 12, hasta: 20, label: '⬇️ Bajan de nivel' }
];
const TOTAL_GRUPO = 20;
// Nombres genéricos para rellenar cuando el grupo real tiene menos de 20
// personas (grupo nuevo, semana recién empezada) -- así la liga siempre
// se ve completa, con las 3 zonas visibles, en vez de cortarse a la
// mitad. Gemas en 0: son relleno visual, nunca "compiten" de verdad ni
// le quitan el cupo a nadie real.
const NOMBRES_DUMMY = [
  'Caminante', 'Viajera', 'Andarina', 'Nómada', 'Trotamundos', 'Peregrina',
  'Exploradora', 'Senderista', 'Rutera', 'Aventurera', 'Marchante', 'Vagabunda'
];
function rellenarConDummies(participantes) {
  if (participantes.length >= TOTAL_GRUPO) return participantes;
  const relleno = [];
  for (let i = participantes.length; i < TOTAL_GRUPO; i++) {
    relleno.push({
      user_id: `dummy-${i}`,
      nombre: `${NOMBRES_DUMMY[i % NOMBRES_DUMMY.length]} ${i + 1}`,
      gemas_semana: 0,
      es_yo: false,
      dummy: true
    });
  }
  return [...participantes, ...relleno];
}

export function renderLiga(container) {
  header(container);
  const wrap = document.createElement('div');
  wrap.innerHTML = '<div class="card center"><p class="muted">Cargando tu liga…</p></div>';
  container.appendChild(wrap);

  Promise.all([fetchLigaEstado(), fetchMiNivelLiga()])
    .then(([participantes, nivel]) => pintar(wrap, participantes, nivel))
    .catch(() => {
      wrap.innerHTML = '<div class="card center"><p class="muted">No pudimos cargar tu liga. Intenta de nuevo más tarde.</p></div>';
    });
}

// Carrusel de las 10 divisiones -- como en Duolingo: se desliza horizontal
// para ver las superadas (niveles < el actual) y las bloqueadas (niveles
// > el actual, atenuadas con un candado), con la actual centrada y
// resaltada al abrir la pantalla.
function pintarCarrusel(nivelActual) {
  const carrusel = document.createElement('div');
  carrusel.className = 'liga-carrusel';
  for (let n = 1; n < NIVELES.length; n++) {
    const tier = NIVELES[n];
    const bloqueada = n > nivelActual;
    const item = document.createElement('div');
    item.className = 'liga-tier' + (n === nivelActual ? ' liga-tier-actual' : '') + (bloqueada ? ' liga-tier-bloqueada' : '');
    item.dataset.nivel = n;
    item.innerHTML = `
      <div class="liga-tier-icon">${bloqueada ? '🔒' : tier.emoji}</div>
      <span class="liga-tier-nombre">${esc(tier.nombre)}</span>`;
    carrusel.appendChild(item);
  }
  return carrusel;
}

function pintar(wrap, participantes, nivel) {
  const tier = NIVELES[nivel] || NIVELES[1];
  wrap.innerHTML = '';

  const carrusel = pintarCarrusel(nivel);
  wrap.appendChild(carrusel);

  const intro = document.createElement('div');
  intro.className = 'center mt mb';
  intro.innerHTML = `
    <h2>${esc(tier.nombre)}</h2>
    <p class="small muted mt">Ganas tu lugar con las gemas 💎 de esta semana. Los primeros 6 suben de nivel, los últimos 8 bajan -- la semana reinicia cada domingo.</p>`;
  wrap.appendChild(intro);

  if (!participantes.length) {
    const vacio = document.createElement('div');
    vacio.className = 'card center';
    vacio.innerHTML = '<p class="muted">Aún no hay nadie en tu grupo esta semana.</p>';
    wrap.appendChild(vacio);
  } else {
    // Un único contenedor plano para TODAS las filas -- antes cada zona
    // (sube/se queda/baja) tenía su propia tarjeta, y eso se veía como un
    // "doble recuadro" por fila y desperdiciaba espacio en pantalla
    // (feedback real de la usuaria comparando con Duolingo, que usa una
    // sola lista continua). Siempre se completa a 20 (rellenarConDummies)
    // para que las 3 zonas se vean siempre, aunque el grupo real sea chico.
    const completa = rellenarConDummies(participantes);
    const lista = document.createElement('div');
    lista.className = 'card';
    for (const zona of ZONAS) {
      const items = completa.slice(zona.desde, zona.hasta);
      if (!items.length) continue;
      const divider = document.createElement('div');
      divider.className = 'section-divider';
      divider.innerHTML = `<span>${zona.label}</span>`;
      lista.appendChild(divider);
      items.forEach((p, idx) => {
        const rank = zona.desde + idx + 1;
        const esUltimaDeZona = idx === items.length - 1;
        const row = document.createElement('div');
        // Sin borde abajo en la última fila de cada zona -- el divisor de
        // la zona siguiente ya marca el corte, la línea extra era
        // redundante (feedback real de la usuaria).
        row.className = 'habit' + (p.es_yo ? ' liga-yo' : '') + (esUltimaDeZona ? ' liga-sin-borde' : '') + (p.dummy ? ' liga-dummy' : '');
        row.innerHTML = `
          <span class="liga-rank">${rank <= 3 && !p.dummy ? MEDALLAS[rank - 1] : rank}</span>
          <label style="flex:1">${esc(p.nombre || 'Alguien en tu ruta')}${p.es_yo ? ' <span class="tag verde">Tú</span>' : ''}</label>
          <span class="small" style="font-weight:700;white-space:nowrap">${p.gemas_semana} 💎</span>`;
        lista.appendChild(row);
      });
    }
    wrap.appendChild(lista);
  }

  // Centra la división actual en el carrusel al abrir -- mismo criterio
  // que Duolingo (la tuya siempre a la vista, sin scrollear a buscarla).
  const actual = carrusel.querySelector('.liga-tier-actual');
  if (actual) actual.scrollIntoView({ inline: 'center', block: 'nearest' });
}
