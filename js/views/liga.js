// Liga semanal de gemas: grupos aleatorios de hasta 20 usuarios del mismo
// nivel, ranking por gemas ganadas ESTA semana (state.ligaGemasSemana,
// otorgada donde ya se otorgan gemas -- ver otorgarGemas en store.js).
// Los primeros 6 suben de nivel, los últimos 8 bajan, el resto se queda
// -- la rotación real corre en el servidor cada domingo (liga_rotar_semana,
// cron), acá solo se lee y se pinta. Backend: ver migración
// liga_semanal_gemas y fetchLigaEstado()/fetchMiNivelLiga() en
// supabase-client.js. Diseño de referencia: carrusel de divisiones +
// lista de posiciones de Duolingo (la usuaria mandó capturas), adaptado
// a los 10 niveles propios de NutriRuta (sinónimos de "ruta/camino").
import { esc, getState, setState } from '../store.js';
import { header, CLOCK_ICON, navigate } from '../app.js';
import { fetchLigaEstado, fetchMiNivelLiga, misAmigos, fetchMiResultadoLiga, marcarResultadoLigaVisto } from '../supabase-client.js';
import { celebrateMilestone } from '../streakAnim.js';
import { rutiMascot } from '../mascot.js';
import { t } from '../i18n.js';

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
  { desde: 0, hasta: 6, label: () => `⬆️ ${t('Suben de nivel')}` },
  { desde: 6, hasta: 12, label: () => t('Se quedan') },
  { desde: 12, hasta: 20, label: () => `⬇️ ${t('Bajan de nivel')}` }
];
const TOTAL_GRUPO = 20;

// Días restantes de la semana de liga (referencia real: Duolingo, "5 DÍAS"
// arriba del carrusel) -- calculado contra el cron real que rota la liga
// cada semana (liga_rotar_semana, lunes 04:59 UTC = domingo 11:59pm hora
// Bogotá), no un número fijo inventado.
function proximoResetUTC() {
  const ahora = new Date();
  const candidato = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), 4, 59, 0));
  let diasHastaLunes = (1 - candidato.getUTCDay() + 7) % 7;
  if (diasHastaLunes === 0 && candidato.getTime() <= ahora.getTime()) diasHastaLunes = 7;
  candidato.setUTCDate(candidato.getUTCDate() + diasHastaLunes);
  return candidato;
}
function diasRestantesLiga() {
  return Math.max(1, Math.ceil((proximoResetUTC().getTime() - Date.now()) / 86400000));
}
// Relleno para cuando el grupo real tiene menos de 20 personas (grupo
// nuevo, semana recién empezada) -- así la liga siempre se ve completa,
// con las 3 zonas visibles, en vez de cortarse a la mitad. Pedido
// explícito (segunda vuelta, tras probar el cupo vacío): nombre + apellido
// que se sientan como personas reales, como en Duolingo -- no las
// palabras temáticas de ruta de antes ("Caminante 4"). Las gemas SIEMPRE
// quedan en 0: nunca se inventa actividad/competencia real, solo el
// nombre para que el grupo no se vea vacío.
const NOMBRES_RELLENO = [
  'Camila Rojas', 'Andrés Peña', 'Valentina Ríos', 'Santiago Cruz', 'Mariana Ortiz',
  'Daniel Vargas', 'Sofía Morales', 'Juan Restrepo', 'Isabella Gómez', 'Sebastián Duarte',
  'Luciana Herrera', 'Nicolás Salazar'
];
function rellenarConDummies(participantes) {
  if (participantes.length >= TOTAL_GRUPO) return participantes;
  const relleno = [];
  for (let i = participantes.length; i < TOTAL_GRUPO; i++) {
    relleno.push({
      user_id: `dummy-${i}`,
      nombre: NOMBRES_RELLENO[i % NOMBRES_RELLENO.length],
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
  wrap.innerHTML = `<div class="card center"><p class="muted">${t('Cargando tu liga…')}</p></div>`;
  container.appendChild(wrap);

  // misAmigos() aparte, con su propio catch -- si falla (o la usuaria
  // simplemente no tiene amigas agregadas todavía) la Liga se pinta igual,
  // solo sin el resaltado de "es tu amiga".
  Promise.all([fetchLigaEstado(), fetchMiNivelLiga(), misAmigos().catch(() => []), fetchMiResultadoLiga().catch(() => null)])
    .then(([participantes, nivel, amigos, resultado]) => {
      pintar(wrap, participantes, nivel, new Set(amigos.map((a) => a.id)));
      if (resultado) mostrarResultadoSemanal(resultado);
    })
    .catch(() => {
      wrap.innerHTML = `<div class="card center"><p class="muted">${t('No pudimos cargar tu liga. Intenta de nuevo más tarde.')}</p></div>`;
    });
}

// Celebración de la rotación semanal (subiste/te quedaste/bajaste de
// nivel + bono de gemas), pedido explícito con referencia de Duolingo --
// pero reutilizando celebrateMilestone() (no un modal con "Continuar"):
// la usuaria ya estableció antes que estas celebraciones nunca deben
// bloquear ni pedir un toque para cerrarse (ver streakAnim.js). El bono
// de gemas se acredita acá mismo, del lado del cliente, justo cuando se
// muestra -- mismo modelo de confianza que el resto de gemas de la app
// (nunca se toca state.gemas desde el servidor, ver nota de nutricoins
// sobre por qué esa columna sí es aparte y esta no hace falta que lo sea).
function mostrarResultadoSemanal(resultado) {
  const { nivel_anterior, nivel_nuevo, puesto, bono_gemas } = resultado;
  const tierNuevo = NIVELES[nivel_nuevo] || NIVELES[1];
  let titulo;
  if (nivel_nuevo > nivel_anterior) titulo = t('¡Subiste a {nivel}!', { nivel: tierNuevo.nombre });
  else if (nivel_nuevo < nivel_anterior) titulo = t('Sigues en tu Ruta -- ahora en {nivel}', { nivel: tierNuevo.nombre });
  else titulo = t('Te mantuviste en {nivel}', { nivel: tierNuevo.nombre });
  celebrateMilestone(`${tierNuevo.emoji} ${titulo}`, t('Puesto #{n} la semana pasada', { n: puesto }));

  const terminar = () => {
    if (bono_gemas > 0) setState({ gemas: (getState().gemas || 0) + bono_gemas });
    marcarResultadoLigaVisto().catch(() => {});
  };
  if (bono_gemas > 0) {
    setTimeout(() => celebrateMilestone(`💎 +${bono_gemas} ${t('gemas')}`, t('Sigue alcanzando el top para seguir ganando.')), 3200);
    setTimeout(terminar, 6400);
  } else {
    setTimeout(terminar, 3200);
  }
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

function pintar(wrap, participantes, nivel, amigosIds = new Set()) {
  const tier = NIVELES[nivel] || NIVELES[1];
  wrap.innerHTML = '';

  const dias = diasRestantesLiga();
  const cabecera = document.createElement('div');
  cabecera.className = 'center mt';
  cabecera.innerHTML = `
    <h2>${esc(tier.nombre)}</h2>
    <p class="small muted row" style="justify-content:center;gap:5px;margin-top:2px">${CLOCK_ICON}${t('{n} día{s}', { n: dias, s: dias === 1 ? '' : 's' })}</p>
    <button type="button" class="btn ghost sm mt" id="liga-amigos-btn">👥 ${t('Amigos')}</button>`;
  wrap.appendChild(cabecera);
  cabecera.querySelector('#liga-amigos-btn').addEventListener('click', () => navigate('friends'));

  const carrusel = pintarCarrusel(nivel);
  wrap.appendChild(carrusel);

  const intro = document.createElement('div');
  intro.className = 'center mt mb';
  intro.innerHTML = `
    <p class="small muted">${t('Ganas tu lugar con las gemas 💎 de esta semana. Los primeros 6 suben de nivel, los últimos 8 bajan -- la semana reinicia cada domingo.')}</p>`;
  wrap.appendChild(intro);

  // Ruti invitando a empezar la semana -- equivalente a Duo pidiendo
  // "completa una lección para unirte a la competencia", pedido explícito
  // con referencia de video. Reemplaza la lista (no se le muestra el
  // ranking todavía) mientras la usuaria no haya ganado ni una gema esta
  // semana -- en cuanto sume la primera, ya ve a todo su grupo.
  const miGemas = participantes.find((p) => p.es_yo)?.gemas_semana ?? 0;
  if (!participantes.length || miGemas === 0) {
    const vacio = document.createElement('div');
    vacio.className = 'card center';
    vacio.innerHTML = `
      ${rutiMascot('saludo', { size: 96 })}
      <p class="mt">${t('Completa tu ruta de hoy para unirte a la competencia de esta semana.')}</p>
      <button type="button" class="btn accent full mt" id="liga-empezar-ruta">${t('Empezar mi ruta de hoy')}</button>`;
    wrap.appendChild(vacio);
    vacio.querySelector('#liga-empezar-ruta').addEventListener('click', () => navigate('dashboard'));
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
      divider.innerHTML = `<span>${zona.label()}</span>`;
      lista.appendChild(divider);
      items.forEach((p, idx) => {
        const rank = zona.desde + idx + 1;
        const esUltimaDeZona = idx === items.length - 1;
        const esAmiga = !p.dummy && amigosIds.has(p.user_id);
        const row = document.createElement('div');
        // Sin borde abajo en la última fila de cada zona -- el divisor de
        // la zona siguiente ya marca el corte, la línea extra era
        // redundante (feedback real de la usuaria).
        row.className = 'habit' + (p.es_yo ? ' liga-yo' : '') + (esUltimaDeZona ? ' liga-sin-borde' : '') + (p.dummy ? ' liga-dummy' : '');
        row.innerHTML = `
          <span class="liga-rank">${rank <= 3 && !p.dummy ? MEDALLAS[rank - 1] : rank}</span>
          <label style="flex:1">${esc(p.nombre || t('Alguien en tu ruta'))}${p.es_yo ? ` <span class="tag verde">${t('Tú')}</span>` : esAmiga ? ' 👥' : ''}</label>
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
