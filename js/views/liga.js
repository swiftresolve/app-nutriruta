// Liga semanal de gemas: grupos aleatorios de hasta 20 usuarias del mismo
// nivel, ranking por gemas ganadas ESTA semana (state.ligaGemasSemana,
// otorgada donde ya se otorgan gemas -- ver otorgarGemas en store.js).
// Los primeros 6 suben de nivel, los últimos 8 bajan, el resto se queda
// -- la rotación real corre en el servidor cada domingo (liga_rotar_semana,
// cron), acá solo se lee y se pinta. Backend: ver migración
// liga_semanal_gemas y fetchLigaEstado()/fetchMiNivelLiga() en
// supabase-client.js.
import { esc } from '../store.js';
import { header } from '../app.js';
import { fetchLigaEstado, fetchMiNivelLiga } from '../supabase-client.js';

// Sinónimos de "ruta/camino", igual que el resto de la marca -- nunca
// gemas/minerales (chocaría con el nombre de la moneda "gemas").
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
// el tamaño real del grupo -- el caso de grupos con menos de 20 quedó
// explícitamente pendiente de definir, así que por ahora la zona de
// alguien depende solo de su posición, no de cuántas haya en total.
const ZONAS = [
  { desde: 0, hasta: 6, label: '⬆️ Suben de nivel' },
  { desde: 6, hasta: 12, label: 'Se quedan' },
  { desde: 12, hasta: 20, label: '⬇️ Bajan de nivel' }
];

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

function pintar(wrap, participantes, nivel) {
  const tier = NIVELES[nivel] || NIVELES[1];
  wrap.innerHTML = `
    <div class="card center" style="background:linear-gradient(135deg, var(--primary-soft), var(--secondary-soft));border:none">
      <div style="font-size:2.4rem">${tier.emoji}</div>
      <h2 class="mt">${esc(tier.nombre)}</h2>
      <p class="small muted mt">Ganas tu lugar con las gemas 💎 de esta semana. Los primeros 6 suben de nivel, los últimos 8 bajan -- la semana reinicia cada domingo.</p>
    </div>
    <div class="mt" id="liga-lista"></div>`;

  const lista = wrap.querySelector('#liga-lista');
  if (!participantes.length) {
    lista.innerHTML = '<div class="card center"><p class="muted">Aún no hay nadie en tu grupo esta semana.</p></div>';
    return;
  }

  for (const zona of ZONAS) {
    const items = participantes.slice(zona.desde, zona.hasta);
    if (!items.length) continue;
    const divider = document.createElement('div');
    divider.className = 'section-divider';
    divider.innerHTML = `<span>${zona.label}</span>`;
    lista.appendChild(divider);

    const grupo = document.createElement('div');
    grupo.className = 'card';
    items.forEach((p, idx) => {
      const rank = zona.desde + idx + 1;
      const row = document.createElement('div');
      row.className = 'habit' + (p.es_yo ? ' liga-yo' : '');
      row.innerHTML = `
        <span class="liga-rank">${rank <= 3 ? MEDALLAS[rank - 1] : rank}</span>
        <label style="flex:1">${esc(p.nombre || 'Alguien en tu ruta')}${p.es_yo ? ' <span class="tag verde">Tú</span>' : ''}</label>
        <span class="small" style="font-weight:700;white-space:nowrap">${p.gemas_semana} 💎</span>`;
      grupo.appendChild(row);
    });
    lista.appendChild(grupo);
  }
}
