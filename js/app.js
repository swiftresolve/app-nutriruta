// Router mínimo + arranque con puerta de autenticación.
import { getState, setState, initCloud, resetState, isPremium, maxEscudos, COSTO_ESCUDO_GEMAS, GEMAS_POR_DIA, comprarEscudo, diasDelMes, today } from './store.js';
import { t } from './i18n.js';
import { getSession, supabase, avatarUrlFor } from './supabase-client.js';
import { broteStage, broteBadge } from './ruti.js';
import { frozenFlameIcon } from './streakAnim.js';
import { renderAuth } from './views/auth.js';
import { renderQuiz } from './views/quiz.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPlanner } from './views/planner.js';
import { renderSOS } from './views/sos.js';
import { renderProgress } from './views/progress.js';
import { renderLearn } from './views/learn.js';
import { renderSettings } from './views/settings.js';
import { renderMission } from './views/mission.js';
import { renderMissionWeek } from './views/missionWeek.js';
import { renderPlans } from './views/plans.js';
import { renderEmergency } from './views/emergency.js';
import { renderAssistant } from './views/assistant.js';
import { renderTestimonials } from './views/testimonials.js';
import { renderResetPassword } from './views/resetPassword.js';
import { renderAdmin } from './views/admin.js';
import { renderWeekMenu } from './views/weekMenu.js';
import { renderDiary } from './views/diary.js';
import { renderLiga } from './views/liga.js';

const app = document.getElementById('app');
const nav = document.getElementById('bottom-nav');

// --vvh: alto REAL visible del navegador, no el de la pantalla completa.
// 100dvh no se achica cuando se abre el teclado en varios navegadores
// móviles (sobre todo iOS Safari) -- el layout del quiz (barra arriba +
// botón fijo abajo, ver styles.css #app.no-nav:has(.quiz-step)) usaba
// 100dvh y el botón "Siguiente" quedaba tapado detrás del teclado al
// escribir el nombre. visualViewport sí reporta el alto real visible
// (se achica con el teclado), así que se expone como variable CSS y se
// mantiene actualizada en cada cambio.
// En iOS Safari eso no bastaba: al enfocar un input el propio Safari
// desplaza la página entera hacia arriba para mantenerlo visible (aunque
// #app tenga overflow:hidden), y como #app queda posicionado respecto al
// viewport de LAYOUT (no al visual, que es el que se mueve), terminaba
// corriéndose hacia arriba y dejando el botón tapado igual. Se compensa
// ese corrimiento aplicando -visualViewport.offsetTop como transform, así
// #app se queda anclado a lo que se ve de verdad en cada momento.
function actualizarVvh() {
  const vv = window.visualViewport;
  document.documentElement.style.setProperty('--vvh', `${(vv ? vv.height : window.innerHeight)}px`);
  app.style.transform = vv && vv.offsetTop ? `translateY(${vv.offsetTop}px)` : '';
  // El teclado abierto se detecta por la diferencia entre el alto real de
  // layout y el visual (--vvh ya la refleja). #app reserva espacio abajo
  // para la bottom-nav (padding-bottom en la regla base) -- con el
  // teclado abierto esa nav queda tapada igual, así que ese padding se
  // veía como un hueco vacío feo entre el input del chat y el teclado
  // (reportado por la usuaria en SuSana). Con el teclado abierto se
  // quita ese padding -- el input queda pegado al teclado.
  const teclaAbierto = vv ? (window.innerHeight - vv.height) > 120 : false;
  app.classList.toggle('keyboard-open', teclaAbierto);
}
actualizarVvh();
window.visualViewport?.addEventListener('resize', actualizarVvh);
window.visualViewport?.addEventListener('scroll', actualizarVvh);
window.addEventListener('resize', actualizarVvh);

const ROUTES = {
  auth: renderAuth,
  quiz: renderQuiz,
  dashboard: renderDashboard,
  planner: renderPlanner,
  sos: renderSOS,
  progress: renderProgress,
  learn: renderLearn,
  settings: renderSettings,
  mission: renderMission,
  missionWeek: renderMissionWeek,
  plans: renderPlans,
  emergency: renderEmergency,
  assistant: renderAssistant,
  testimonials: renderTestimonials,
  resetPassword: renderResetPassword,
  admin: renderAdmin,
  weekMenu: renderWeekMenu,
  diary: renderDiary,
  liga: renderLiga
};

// 'quiz' es público: ahora se responde ANTES de crear cuenta (ver spec de
// "login después del quiz") — las respuestas se guardan localmente y se
// migran a la cuenta recién creada en initCloud() (ver store.js).
const PUBLIC_ROUTES = ['auth', 'resetPassword', 'quiz'];
let authed = false;

export function setAuthed(v) { authed = v; }

export function navigate(route, params = {}) {
  if (!authed && !PUBLIC_ROUTES.includes(route)) route = 'auth';
  const render = ROUTES[route] || renderDashboard;
  app.innerHTML = '';
  window.scrollTo(0, 0);
  document.getElementById('scroll-top-btn').classList.add('hidden');
  render(app, params);
  // Reinicia la animación de entrada (quitar+forzar reflow+agregar la clase)
  // para que se vea en cada navegación, no solo la primera vez.
  app.classList.remove('page-enter');
  void app.offsetWidth;
  app.classList.add('page-enter');

  const showNav = route !== 'quiz' && route !== 'auth' && route !== 'resetPassword' && route !== 'sos';
  nav.classList.toggle('hidden', !showNav);
  // Sin bottom-nav no hace falta reservarle espacio abajo -- si no, queda
  // un hueco vacío grande en pantallas cortas como la bienvenida del quiz.
  app.classList.toggle('no-nav', !showNav);
  // Clase propia para el quiz (en vez de depender de #app.no-nav:has(.quiz-step)
  // en el CSS) -- :has() no lo soportan todos los navegadores/WebView
  // Android reales, y sin soporte esa regla simplemente no aplicaba nunca:
  // el botón "Siguiente" quedaba en flujo normal, sin el alto fijo que lo
  // mantiene pegado arriba del teclado. Esta clase la pone JS a mano, con
  // el route ya conocido, así que funciona sin importar el navegador.
  // SOS reutiliza el mismo mecanismo de pantalla completa que el quiz
  // (ver .quiz-step/.quiz-nav en CSS) -- ahora es un recorrido de varias
  // pantallas igual que el quiz, no una sola pantalla con tarjetas.
  app.classList.toggle('quiz-active', route === 'quiz' || route === 'sos');
  // El chat de SuSana necesita el mismo truco que el quiz: #app fijo a la
  // altura real de pantalla (--vvh) y adentro un flex-column donde SOLO
  // la tarjeta de mensajes hace scroll -- así la tarjeta siempre llega
  // hasta justo arriba de la caja de texto, esté vacía, cargando o llena
  // (antes usaba min-height:40vh, un valor fijo que se quedaba corto y
  // dejaba un hueco vacío feo entre la tarjeta y el input).
  app.classList.toggle('chat-active', route === 'assistant');
  nav.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.route === route);
  });
  nav.querySelectorAll('.nav-label').forEach((el) => { el.textContent = t(el.dataset.label); });
}

nav.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-route]');
  if (btn) navigate(btn.dataset.route);
});

// Botón flotante "subir al inicio" -- pantallas largas (Recetario,
// Progreso, Configuración) obligaban a scrollear mucho para volver
// arriba. Aparece solo tras bajar un poco (SCROLL_TOP_UMBRAL), y solo en
// rutas con bottom-nav visible (en el quiz/auth no aplica).
const scrollTopBtn = document.getElementById('scroll-top-btn');
const SCROLL_TOP_UMBRAL = 400;
window.addEventListener('scroll', () => {
  const mostrar = window.scrollY > SCROLL_TOP_UMBRAL && !nav.classList.contains('hidden');
  scrollTopBtn.classList.toggle('hidden', !mostrar);
}, { passive: true });
scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), ms);
}

// Nombre de la guía IA, "Su" + "Sana" en dos colores (ver CSS .susana-name).
export function susanaName() {
  return '<span class="susana-name"><span class="su">Su</span><span class="sana">Sana</span></span>';
}

// Abre/cierra un tooltip anclado al botón, se cierra solo a los pocos
// segundos o al tocar fuera. Un solo tooltip abierto a la vez.
// html puede ser un string fijo o una función que lo genere en el momento
// del clic — necesario para el de escudos, cuyo botón de "comprar" depende
// de un saldo que puede cambiar sin recargar la vista (compra hecha y
// vuelta a abrir el mismo tooltip en la misma sesión).
function attachStatTooltip(btn, html, { onRender, duracion = 3500 } = {}) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const yaAbierto = btn.querySelector('.header-tooltip');
    document.querySelectorAll('.header-tooltip').forEach((t) => t.remove());
    if (yaAbierto) return;
    const tip = document.createElement('div');
    tip.className = 'header-tooltip';
    tip.innerHTML = typeof html === 'function' ? html() : html;
    btn.appendChild(tip);
    // La burbuja se ancla por defecto al borde derecho de SU PROPIO botón
    // (ver CSS) -- para el de racha o gemas, más a la izquierda dentro del
    // grupo de stats, eso la hacía desbordarse fuera de pantalla por la
    // izquierda. Se corrige después de pintarla, corriéndola lo justo para
    // que quede siempre dentro del viewport (con margen), sin tocar el caso
    // que ya funcionaba bien (el de escudos, pegado al borde derecho).
    requestAnimationFrame(() => {
      const margen = 10;
      const rect = tip.getBoundingClientRect();
      let corrimiento = 0;
      if (rect.left < margen) corrimiento = margen - rect.left;
      else if (rect.right > window.innerWidth - margen) corrimiento = (window.innerWidth - margen) - rect.right;
      if (corrimiento) tip.style.transform = `translateX(${corrimiento}px)`;
    });
    const cerrar = () => { tip.remove(); document.removeEventListener('click', fuera); };
    const timer = setTimeout(cerrar, duracion);
    const fuera = (ev) => { if (!btn.contains(ev.target)) { clearTimeout(timer); cerrar(); } };
    setTimeout(() => document.addEventListener('click', fuera), 0);
    if (onRender) onRender(tip, cerrar);
  });
}

// Ícono de ajustes: tuerca simple de un solo color, sin degradado ni
// brillo, sin el círculo de fondo del botón (queda "suelta" en el header,
// Ícono real de una librería gratuita (Heroicons, MIT — "Cog6Tooth"), no
// dibujado a mano -- la usuaria pidió explícitamente evitar aproximaciones
// "vectorizadas" caseras y usar un ícono idéntico al de su referencia.
export const GEAR_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--primary-dark)" stroke-width="1.8" style="display:block">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/>
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
</svg>`;

// Lupa de línea (sin relleno) -- misma familia visual que GEAR_ICON: un
// solo color, trazo limpio, nada de emoji con su propio look fijo por
// dispositivo.
export const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" style="display:block" fill="none">
  <circle cx="10.5" cy="10.5" r="6.5" stroke="var(--primary-dark)" stroke-width="2"/>
  <path d="M15.5 15.5 L21 21" stroke="var(--primary-dark)" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// Íconos reales de Heroicons (MIT), mismo criterio que GEAR_ICON --
// minimalistas, un solo trazo sin relleno, en vez de emoji con su look
// fijo por dispositivo. currentColor hereda el color del botón que los
// use (icon-btn ya define su propio color).
export const REFRESH_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--primary-dark)" stroke-width="1.8" style="display:block">
  <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>
</svg>`;

export const CAMERA_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--primary-dark)" stroke-width="1.8" style="display:block">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"/>
  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"/>
</svg>`;

// "Nueva conversación" (historial de SuSana) -- trazo fino sin relleno,
// mismo lenguaje visual que el resto de íconos propios (nunca emoji).
export const PENCIL_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--primary-dark)" stroke-width="1.8" style="display:block">
  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/>
</svg>`;

// "Compartir" (Mi Diario) -- el ícono clásico de exportar (bandeja +
// flecha hacia arriba), minimalista y sin color, referencia real de la
// usuaria -- en vez del emoji 📤, que se veía distinto según el teléfono.
export const SHARE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--primary-dark)" stroke-width="1.8" style="display:block">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
</svg>`;

// Cámara, micrófono y teclado (texto) para el selector de "¿Qué comiste?"
// en Tu ruta de hoy (foto/voz/texto, ver mealLogModal.js) -- cada uno
// elegido a partir de una imagen de referencia real que dio la usuaria
// (nunca aproximados a mano): cámara de trazo grueso simple, micrófono y
// teclado de silueta rellena. currentColor en los 3 -- el color blanco
// lo pone el CSS del círculo (.ml-opcion-circle), no el SVG.
export const CAMERA_SOLID_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">
  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
  <circle cx="12" cy="13" r="4"/>
</svg>`;
export const MIC_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" style="display:block">
  <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z"/>
  <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z"/>
</svg>`;
export const TEXTO_ICON = `<svg viewBox="0 -960 960 960" width="24" height="24" fill="currentColor" style="display:block">
  <path d="M160-200q-33 0-56.5-23.5T80-280v-400q0-33 23.5-56.5T160-760h640q33 0 56.5 23.5T880-680v400q0 33-23.5 56.5T800-200H160Zm0-80h640v-400H160v400Zm160-40h320v-80H320v80ZM200-440h80v-80h-80v80Zm120 0h80v-80h-80v80Zm120 0h80v-80h-80v80Zm120 0h80v-80h-80v80Zm120 0h80v-80h-80v80ZM200-560h80v-80h-80v80Zm120 0h80v-80h-80v80Zm120 0h80v-80h-80v80Zm120 0h80v-80h-80v80Zm120 0h80v-80h-80v80ZM160-280v-400 400Z"/>
</svg>`;

// Cabecera común de las vistas principales. Cuando ya hay cuenta activa,
// muestra racha y escudos arriba a la derecha (persistentes, como el
// marcador de racha de Duolingo) — tocar cualquiera abre el detalle.
export function header(container) {
  const h = document.createElement('div');
  h.className = 'app-header';
  const state = getState();
  const mostrarStats = state.onboarded;
  const racha = state.racha?.actual || 0;
  const escudos = state.escudos || 0;
  const gemas = state.gemas || 0;
  const nutricoins = state.nutricoins || 0;

  h.innerHTML = `
    <span class="brand"><svg viewBox="0 0 512 512"><defs><linearGradient id="nrleaf" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#7CC96A"/><stop offset="1" stop-color="#3E9E52"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="#2BB5A0"/><g fill="none" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="13"><ellipse cx="256" cy="396" rx="148" ry="36"/><ellipse cx="256" cy="396" rx="86" ry="21"/></g><path d="M256 68 C168 68 100 136 100 222 C100 316 202 398 256 434 C310 398 412 316 412 222 C412 136 344 68 256 68 Z" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linejoin="round"/><g transform="translate(252 210) scale(0.55) translate(-256 -288)"><path d="M256 416c-72-48-136-102-136-176 0-45 34-80 78-80 28 0 48 13 58 32 10-19 30-32 58-32 44 0 78 35 78 80 0 74-64 128-136 176z" fill="#FFFFFF"/></g><g transform="translate(288 210) rotate(35)"><path d="M0 -40 C26 -24 28 10 0 40 C-28 10 -26 -24 0 -40 Z" fill="url(#nrleaf)"/><path d="M0 36 L-9 60" stroke="#3E9E52" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M0 -30 L0 32 M0 -16 L13 -25 M0 -16 L-13 -25 M0 2 L15 -7 M0 2 L-15 -7 M0 18 L12 9 M0 18 L-12 9" stroke="#FFFFFF" stroke-width="3.5" fill="none" stroke-linecap="round"/></g></svg><span class="brand-text">NutriRuta</span></span>
    <div class="row" style="gap:2px;min-width:0">
      ${mostrarStats ? `
        <div class="header-stats">
          <button class="header-stat" id="hs-racha" aria-label="Tus Días en Ruta"><span class="icon streak-flame ${racha > 0 ? 'lit' : 'out'}">🔥</span>${racha}</button>
          <button class="header-stat" id="hs-gemas" aria-label="Tus gemas"><span class="icon">💎</span>${gemas}</button>
          <button class="header-stat${nutricoins > 0 ? '' : ' sin-saldo'}" id="hs-nutricoins" aria-label="Tus NutriCoins">${coinIcon(nutricoins > 0 ? ORO_NUTRICOINS : PLATA_NUTRICOINS, 15)}<span class="value">${nutricoins}</span></button>
          <button class="header-stat" id="hs-escudos" aria-label="Tus Pausas de Ruta"><span class="icon">🛡️</span>${escudos}</button>
        </div>` : ''}
      <button class="icon-btn plain" data-go="settings" aria-label="${t('Ajustes')}">${GEAR_ICON}</button>
    </div>`;
  h.querySelector('[data-go]').addEventListener('click', () => navigate('settings'));

  if (mostrarStats) {
    h.querySelector('#hs-racha').addEventListener('click', (e) => { e.stopPropagation(); abrirMisRachas(); });
    h.querySelector('#hs-nutricoins').addEventListener('click', (e) => { e.stopPropagation(); abrirComprarNutricoins(); });
    attachStatTooltip(h.querySelector('#hs-gemas'), `
      <strong>💎 ${gemas} gemas</strong>
      <p class="small muted mt" style="margin-top:4px">Ganas ${GEMAS_POR_DIA} 💎 cada día que completas, y más al terminar un día del Plan de 7 días o una semana de la Misión.</p>
      <p class="small muted" style="margin-top:2px">Se usan para comprar Pausas de Ruta extra — mira el 🛡️.</p>`);
    attachStatTooltip(h.querySelector('#hs-escudos'), () => {
      const st = getState();
      const e = st.escudos || 0;
      const g = st.gemas || 0;
      const max = maxEscudos();
      return `
        <strong>🛡️ ${e}/${max} Pausas de Ruta</strong>
        <p class="small muted mt" style="margin-top:4px">Te acompañan cuando necesitas descansar — tu Ruta sigue en pie. Se gana 1 cada 7 Días en Ruta.${isPremium() ? '' : ' Con Premium, hasta 4.'}</p>
        ${e < max ? `<button class="btn ghost sm mt" id="tt-comprar-escudo" ${g < COSTO_ESCUDO_GEMAS ? 'disabled' : ''}>Comprar por ${COSTO_ESCUDO_GEMAS} 💎</button>` : ''}
      `;
    }, {
      duracion: 6000,
      onRender: (tip, cerrar) => {
        const btn = tip.querySelector('#tt-comprar-escudo');
        if (!btn) return;
        btn.addEventListener('click', () => {
          if (!comprarEscudo()) return;
          cerrar();
          toast('🛡️ ¡Nueva Pausa de Ruta lista!');
          // Actualiza los botones del header en el sitio — header() los
          // vuelve a pintar por completo en cada vista de todas formas, esto
          // solo evita esperar a la próxima navegación para verlo reflejado.
          const st = getState();
          const escudosBtn = document.querySelector('#hs-escudos');
          const gemasBtn = document.querySelector('#hs-gemas');
          if (escudosBtn) escudosBtn.innerHTML = `<span class="icon">🛡️</span>${st.escudos || 0}`;
          if (gemasBtn) gemasBtn.innerHTML = `<span class="icon">💎</span>${st.gemas || 0}`;
        });
      }
    });
  }

  container.appendChild(h);
}

const MONTH_LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTH_NOMBRES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_CORTOS_RACHA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// Tira de los últimos 7 días (terminando hoy), un cuadrito por día — a
// simple vista de un vistazo, además del calendario del mes completo.
function weekStrip(diasCumplidos, diasCongelados = []) {
  const set = new Set(diasCumplidos);
  const congelados = new Set(diasCongelados);
  const hoyISO = new Date().toISOString().slice(0, 10);
  const celdas = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const cumplido = set.has(iso);
    const congelado = congelados.has(iso);
    const esHoy = iso === hoyISO;
    // Día pasado, sin cumplir y sin Pausa de Ruta que lo cubriera: se
    // marca como "perdido" -- visualmente parecido a un día congelado
    // (mismo círculo), pero con una equis gris adentro en vez de la
    // llamita de hielo, para distinguir "se rompió la racha" de "una
    // Pausa la protegió".
    const perdido = !cumplido && !congelado && !esHoy && iso < hoyISO;
    celdas.push(`
      <div class="week-cell${cumplido ? ' done' : ''}${congelado ? ' frozen' : ''}${perdido ? ' perdido' : ''}${esHoy ? ' today' : ''}">
        <span class="week-day">${DIAS_CORTOS_RACHA[d.getDay()]}</span>
        <span class="week-dot">${congelado ? frozenFlameIcon(18) : cumplido ? '✓' : perdido ? '✕' : ''}</span>
      </div>`);
  }
  return celdas.join('');
}

// Contenido de racha compartido entre el modal "Mis Rachas" (header) y la
// tarjeta de racha de la pantalla Progreso -- antes cada uno tenía su
// propia versión y se iban desalineando (uno mostraba gemas ganadas, el
// otro no; uno tenía calendario del mes, el otro solo la tira de 7 días).
// Ahora ambos usan exactamente este mismo bloque, con el calendario
// completo (más información que una tira de 7 días) y el mensaje de
// compromiso cumplido, para que nunca queden desiguales.
export function rachaDetailHtml(month, year, { size = 56 } = {}) {
  const state = getState();
  const { racha, user, escudos, gemas, energiaRuta, kmRuta, diasCumplidos, diasCongelados } = state;
  const etapa = broteStage(racha.actual);
  const diasEsteMes = diasCumplidos.filter((d) => d.slice(0, 7) === today().slice(0, 7)).length;
  const hoy = new Date();
  const esMesActual = year === hoy.getFullYear() && month === hoy.getMonth();
  const celdas = diasDelMes(year, month);

  const compromisoHtml = user.compromisoDias ? `
    <div class="mt">
      <div class="spread small" style="font-weight:700">
        <span>Tu compromiso: ${user.compromisoDias} días</span>
        <span>${Math.min(racha.actual, user.compromisoDias)}/${user.compromisoDias}</span>
      </div>
      <div class="quiz-progress" style="margin:6px 0 0">
        <div style="width:${Math.min(100, Math.round((racha.actual / user.compromisoDias) * 100))}%"></div>
      </div>
      ${racha.actual >= user.compromisoDias ? '<p class="small mt" style="color:var(--primary-dark);font-weight:700">¡Cumpliste tu compromiso! 🎉 Sigue cuando quieras.</p>' : ''}
    </div>` : '';

  return `
    <div class="rachas-hero mt">
      <div class="row" style="gap:12px; align-items:center; justify-content:center">
        ${broteBadge(etapa, { size, premium: isPremium() })}
        <p class="num" style="margin:0">${racha.actual} <span class="streak-flame ${racha.actual > 0 ? 'lit' : 'out'}">🔥</span></p>
      </div>
      <p class="mt"><strong>Días en Ruta</strong></p>
      <p class="small muted">Tu Brote de Ruta está creciendo con cada paso.</p>
      <p class="small muted"><strong>${etapa.label}</strong> — Ruti está orgullosa de tu constancia.</p>
      <div class="week-strip mt">${weekStrip(diasCumplidos, diasCongelados)}</div>
    </div>
    <div class="rachas-stats mt">
      <div><span class="n">${racha.mejor}</span><span class="l">Mejor Ruta</span></div>
      <div><span class="n">${diasEsteMes}</span><span class="l">Este mes</span></div>
      <div><span class="n">${escudos}/${maxEscudos()}</span><span class="l">Pausas</span></div>
    </div>
    ${compromisoHtml}
    <div class="month-nav mt">
      <button class="mr-prev" aria-label="Mes anterior">‹</button>
      <strong>${MONTH_NOMBRES[month]} ${year}</strong>
      <button class="mr-next" aria-label="Mes siguiente" ${esMesActual ? 'disabled' : ''}>›</button>
    </div>
    <div class="month-grid mt">
      ${MONTH_LETRAS.map((l) => `<span class="month-head">${l}</span>`).join('')}
      ${celdas.map((c) => `
        <div class="month-cell${c.fueraDeMes ? ' fuera' : ''}${c.esHoy ? ' hoy' : ''}${c.cumplido ? ' cumplido' : c.congelado ? ' congelado' : c.pctHabitos > 0 ? ' parcial' : ''}">
          <span class="month-dot">${c.congelado && !c.cumplido ? frozenFlameIcon(18) : c.dia}</span>
        </div>`).join('')}
    </div>
    <p class="small muted mt center">🛡️ Pausas de Ruta: te acompañan cuando necesitas descansar sin romper tu racha. Se gana 1 cada 7 Días en Ruta.</p>
    <p class="small muted center">⚡ Energía de Ruta: ${energiaRuta || 0} · ${kmRuta || 0} km recorridos · 💎 ${gemas} gemas ganadas.</p>`;
}

// "Mis Rachas": calendario mensual completo al tocar la llama del header,
// en vez del tooltip corto que tenía antes -- inspirado en la pantalla
// de rachas de Fitia, pero con datos reales de NutriRuta (Brote de Ruta,
// Pausas en vez de rachas que se rompen de golpe, gemas) en lugar de su
// métrica de "días perfectos" atada a calorías, que no aplica aquí. Único
// lugar de la app donde se ve la racha en detalle -- ya no se repite en
// Progreso, que ahora solo tiene un acceso directo a este mismo modal.
function abrirMisRachas() {
  const hoy = new Date();
  let year = hoy.getFullYear();
  let month = hoy.getMonth();

  openModal((modal, closeFn) => {
    const wrap = document.createElement('div');
    modal.appendChild(wrap);

    function pintar() {
      wrap.innerHTML = `
        <h2 class="center">🔥 Mis Rachas</h2>
        ${rachaDetailHtml(month, year, { size: 56 })}
        <button class="btn ghost full mt" id="mr-ver-progreso">Ver todo mi progreso →</button>`;

      wrap.querySelector('.mr-prev').addEventListener('click', () => {
        month -= 1;
        if (month < 0) { month = 11; year -= 1; }
        pintar();
      });
      const nextBtn = wrap.querySelector('.mr-next');
      if (!nextBtn.disabled) {
        nextBtn.addEventListener('click', () => {
          month += 1;
          if (month > 11) { month = 0; year += 1; }
          pintar();
        });
      }
      wrap.querySelector('#mr-ver-progreso').addEventListener('click', () => {
        closeFn();
        navigate('progress');
      });
    }

    pintar();
  });
}

// Bloqueo de scroll del fondo mientras hay una modal abierta -- antes
// tocar/hacer scroll "a través" del backdrop movía la pantalla de atrás
// (position:fixed del backdrop no basta por sí solo, sobre todo en
// móvil). Con contador por si una modal abre otra (p.ej. comprar Pausa de
// Ruta desde un tooltip que a su vez está sobre una modal).
let modalLockCount = 0;
function lockBodyScroll() {
  if (modalLockCount === 0) {
    const scrollY = window.scrollY;
    document.body.dataset.modalScrollY = String(scrollY);
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
  }
  modalLockCount++;
}
function unlockBodyScroll() {
  modalLockCount = Math.max(0, modalLockCount - 1);
  if (modalLockCount === 0) {
    const scrollY = parseInt(document.body.dataset.modalScrollY || '0', 10);
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    delete document.body.dataset.modalScrollY;
    window.scrollTo(0, scrollY);
  }
}

// Modal reutilizable.
export function openModal(contentBuilder) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  const close = document.createElement('button');
  close.className = 'modal-close';
  close.setAttribute('aria-label', 'Cerrar');
  close.textContent = '✕';
  let closed = false;
  const closeFn = () => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    unlockBodyScroll();
  };
  close.addEventListener('click', closeFn);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeFn(); });
  modal.appendChild(close);
  contentBuilder(modal, closeFn);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  lockBodyScroll();
  return closeFn;
}

// Ícono de moneda propio (no el emoji 🪙): en varios teléfonos (sobre todo
// Android) esa emoji se dibuja en un tono grisáceo/plateado según la
// fuente del sistema -- el "dorado siempre, plateado solo en cero" que
// pidió la usuaria no se puede lograr recoloreando un emoji con CSS
// (color: no afecta emojis, son glifos con su propio color fijo). Un SVG
// propio sí se puede pintar del color que sea, siempre igual en cualquier
// dispositivo.
export function coinIcon(color, size = 16) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display:inline-block;vertical-align:-3px;flex:none">
    <circle cx="12" cy="12" r="10" fill="${color}"/>
    <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="1"/>
    <circle cx="12" cy="12" r="7.2" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
    <text x="12" y="16.3" text-anchor="middle" font-size="11" font-weight="800" fill="rgba(255,255,255,0.9)" font-family="inherit">$</text>
  </svg>`;
}
export const ORO_NUTRICOINS = '#D4A017';
export const PLATA_NUTRICOINS = '#9AA5A0';

// Paquetes de NutriCoins -- MAQUETA (ver nota abajo). Precios en COP,
// provisionales: hay que reemplazarlos por los reales una vez existan los
// productos de compra única en Hotmart. Vive en app.js (no en
// views/settings.js) para que el header (arriba) también pueda abrirla
// directamente al tocar el ícono 🪙, sin crear un import circular con
// settings.js (que ya importa varias cosas de aquí).
const PAQUETES_NUTRICOINS = [
  { cant: 100, precio: 3900 },
  { cant: 500, precio: 16900 },
  { cant: 1000, precio: 29900, popular: true },
  { cant: 2500, precio: 59900 }
];

export function abrirComprarNutricoins() {
  openModal((modal) => {
    const nutricoins = getState().nutricoins || 0;
    modal.insertAdjacentHTML('beforeend', `
      <h2>Tus NutriCoins</h2>
      <p class="num mt" style="margin:2px 0 0;display:flex;align-items:center;gap:8px">${coinIcon(ORO_NUTRICOINS, 26)}${nutricoins}</p>
      <p class="small muted mt">Se usan para extras puntuales -- nunca para saltarte hábitos ni comprar Pausas de Ruta, eso sigue siendo solo con constancia.</p>
      <p class="small mt" style="font-weight:600">Comprar NutriCoins</p>
      <div class="farol-grid mt">
        ${PAQUETES_NUTRICOINS.map((p, i) => `
          <button type="button" class="farol-pack${p.popular ? ' popular' : ''}" data-i="${i}">
            ${p.popular ? '<span class="farol-badge">Popular</span>' : ''}
            <span class="farol-cant">${p.cant.toLocaleString('es')}</span>
            <span class="small muted">NutriCoins</span>
            <span class="farol-emoji">${coinIcon(ORO_NUTRICOINS, 34)}</span>
            <span class="farol-precio">$${p.precio.toLocaleString('es')}</span>
          </button>`).join('')}
      </div>
      <p class="small muted mt">Los paquetes y precios todavía son provisionales -- esta pantalla es una maqueta mientras se conecta el cobro real.</p>`);
    modal.querySelectorAll('.farol-pack').forEach((btn) => {
      btn.addEventListener('click', () => {
        toast('Muy pronto vas a poder comprar NutriCoins aquí mismo 🪙');
      });
    });
  });
}

// Service worker (registrado aquí para cumplir la CSP sin scripts inline).
// sw.js ya usa skipWaiting()+clients.claim() para tomar control apenas se
// instala una versión nueva, pero sin este listener la pestaña ya abierta
// se queda corriendo el JS viejo en memoria hasta que alguien recarga a
// mano — la usuaria reportó justo eso ("no veo qué cambió" tras un
// despliegue). controllerchange dispara exactamente cuando el nuevo SW
// toma control, así que ese es el momento correcto para recargar sola.
// El flag `refrescando` evita un loop: controllerchange solo debería
// disparar una vez por cambio real de versión.
if ('serviceWorker' in navigator) {
  let refrescando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refrescando) return;
    refrescando = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // register() por sí solo no siempre revisa si hay una versión nueva
      // -- el navegador lo hace "cuando le parece" (a veces tarda varias
      // aperturas en notar el cambio, causando bugs reales de "ya lo
      // arreglé pero se sigue viendo viejo"). update() fuerza la
      // comparación contra el servidor ahora mismo, y de nuevo cada vez
      // que se vuelve a esta pestaña/app (abrir la PWA de nuevo, por
      // ejemplo) -- entre eso y el fetch "red primero" para el código de
      // la app (ver sw.js), un despliegue nuevo debería verse casi de
      // inmediato, no varias recargas después.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update();
      });
    });
  });
}

// Arranque: verificar sesión JWT antes de entrar.
(async () => {
  // Enlace de invitación (compró en Hotmart, cuenta creada automáticamente,
  // falta poner contraseña) o de "olvidé mi contraseña": Supabase ya deja
  // la sesión lista al leer la URL (detectSessionInUrl en supabase-client.js);
  // aquí solo hace falta llevar a la pantalla de crear contraseña en vez del
  // flujo normal de login/dashboard.
  //
  // No se detecta con el "type=" que agrega Supabase (ese parámetro solo
  // aparece en el flujo antiguo/implícito; con PKCE, que es el que usan la
  // mayoría de proyectos hoy, el enlace solo trae "?code=..." sin "type").
  // En su lugar, el propio redirectTo (ver hotmart-webhook) agrega
  // "?invite=1" como marca propia en la query string — ahí Supabase solo
  // añade su "code" al lado sin tocarla, así que la detección no depende de
  // un detalle interno de Supabase que puede cambiar entre versiones.
  const isInviteLink = new URLSearchParams(window.location.search).has('invite');
  const isResetLink = new URLSearchParams(window.location.search).has('reset');

  let session = null;
  try { session = await getSession(); } catch { /* offline sin sesión previa */ }
  authed = !!session;

  // Enlace de referido ("?ref=CODIGO", compartido desde Ajustes): se guarda
  // en el estado local ANTES de crear la cuenta, así viaja con el resto del
  // quiz/onboarding y sube a la nube con la migración normal que ya hace
  // initCloud() al registrarse — no hace falta lógica aparte. Nunca
  // sobreescribe uno que ya tenga (evita que abrir un segundo link cambie
  // a quién ya se le atribuyó la referida), y nunca se aplica si ya hay
  // sesión (una cuenta existente no se "re-refiere").
  if (!session) {
    const refCode = new URLSearchParams(window.location.search).get('ref');
    if (refCode && !getState().user.referidoPor) {
      setState({ user: { ...getState().user, referidoPor: refCode.trim().toUpperCase().slice(0, 12) } });
    }
  }

  if ((isInviteLink || isResetLink) && session) {
    navigate('resetPassword', { modo: isResetLink ? 'reset' : 'invite' });
  } else {
    if (session) {
      await initCloud();
      // Precarga la foto de perfil apenas hay sesión, no cuando se abre
      // Ajustes -- así, para cuando la usuaria toca el botón de
      // configuración, el navegador ya la tiene en caché y no hay el
      // "parpadeo" de la inicial antes de que aparezca la foto real.
      new Image().src = avatarUrlFor(session.user.id);
    }
    // El quiz ya no vive detrás del login: se responde primero (invitada,
    // sin cuenta) y la cuenta se crea al final para guardarlo. Por eso el
    // primer chequeo es "¿ya lo completó?", no "¿tiene sesión?":
    // - onboarded=true y sin sesión: acaba de terminar el quiz como
    //   invitada → a crear la cuenta que lo va a guardar (auth).
    // - onboarded=true y con sesión: usuaria normal que vuelve → dashboard.
    // - onboarded=false: nunca lo completó en este dispositivo (sea porque
    //   es nueva o porque tiene sesión pero no lo ha hecho) → quiz.
    navigate(getState().onboarded ? 'dashboard' : 'quiz', { mode: 'signup' });
  }

  supabase.auth.onAuthStateChange((event) => {
    // Al cerrar sesión, nunca dejar el progreso de esta cuenta en el
    // navegador: si alguien más entra o se registra aquí después, no debe
    // heredar racha, misión ni plan de 7 días de la sesión anterior.
    if (event === 'SIGNED_OUT') { authed = false; resetState(); navigate('auth'); }
    if (event === 'SIGNED_IN' && !authed) { authed = true; }
  });
})();
