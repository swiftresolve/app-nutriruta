// Router mínimo + arranque con puerta de autenticación.
import { getState, setState, initCloud, resetState, isPremium, maxEscudos, COSTO_ESCUDO_GEMAS, GEMAS_POR_DIA, comprarEscudo } from './store.js';
import { t } from './i18n.js';
import { getSession, supabase } from './supabase-client.js';
import { broteStage, broteBadge } from './ruti.js';
import { renderAuth } from './views/auth.js';
import { renderQuiz } from './views/quiz.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPlanner } from './views/planner.js';
import { renderSOS } from './views/sos.js';
import { renderProgress } from './views/progress.js';
import { renderLearn } from './views/learn.js';
import { renderSettings } from './views/settings.js';
import { renderMission } from './views/mission.js';
import { renderPlans } from './views/plans.js';
import { renderEmergency } from './views/emergency.js';
import { renderAssistant } from './views/assistant.js';
import { renderTestimonials } from './views/testimonials.js';
import { renderResetPassword } from './views/resetPassword.js';
import { renderAdmin } from './views/admin.js';
import { renderWeekMenu } from './views/weekMenu.js';
import { renderDiary } from './views/diary.js';

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
function actualizarVvh() {
  const vv = window.visualViewport;
  document.documentElement.style.setProperty('--vvh', `${(vv ? vv.height : window.innerHeight)}px`);
}
actualizarVvh();
window.visualViewport?.addEventListener('resize', actualizarVvh);
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
  plans: renderPlans,
  emergency: renderEmergency,
  assistant: renderAssistant,
  testimonials: renderTestimonials,
  resetPassword: renderResetPassword,
  admin: renderAdmin,
  weekMenu: renderWeekMenu,
  diary: renderDiary
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
  render(app, params);
  // Reinicia la animación de entrada (quitar+forzar reflow+agregar la clase)
  // para que se vea en cada navegación, no solo la primera vez.
  app.classList.remove('page-enter');
  void app.offsetWidth;
  app.classList.add('page-enter');

  const showNav = route !== 'quiz' && route !== 'auth' && route !== 'resetPassword';
  nav.classList.toggle('hidden', !showNav);
  // Sin bottom-nav no hace falta reservarle espacio abajo -- si no, queda
  // un hueco vacío grande en pantallas cortas como la bienvenida del quiz.
  app.classList.toggle('no-nav', !showNav);
  nav.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.route === route);
  });
  nav.querySelectorAll('.nav-label').forEach((el) => { el.textContent = t(el.dataset.label); });
}

nav.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-route]');
  if (btn) navigate(btn.dataset.route);
});

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
    const cerrar = () => { tip.remove(); document.removeEventListener('click', fuera); };
    const timer = setTimeout(cerrar, duracion);
    const fuera = (ev) => { if (!btn.contains(ev.target)) { clearTimeout(timer); cerrar(); } };
    setTimeout(() => document.addEventListener('click', fuera), 0);
    if (onRender) onRender(tip, cerrar);
  });
}

// Ícono de ajustes: reemplaza el emoji ⚙️ (en la mayoría de fuentes se
// dibuja en perspectiva/inclinado) por un engranaje propio, de frente.
// Segunda versión: el gris industrial de la primera no encajaba con la
// marca — ahora usa el verde agua de la app (--primary/--primary-dark,
// mismo degradado que ya usan .btn y .avatar-upload), un aro hueco en vez
// de disco sólido (más "cog" reconocible, menos "tuerca oscura") y un
// brillo suave arriba-izquierda para el volumen, sin inclinar el dibujo.
const GEAR_ICON = `<svg viewBox="0 0 40 40" width="23" height="23" style="display:block">
  <defs>
    <linearGradient id="gear-face" x1="0.15" y1="0.1" x2="0.85" y2="0.9">
      <stop offset="0%" stop-color="#4FD3BC"/>
      <stop offset="100%" stop-color="#1E8A7A"/>
    </linearGradient>
  </defs>
  <g fill="url(#gear-face)">
    <rect x="17" y="0.5" width="6" height="8" rx="2.4"/>
    <rect x="17" y="31.5" width="6" height="8" rx="2.4"/>
    <rect x="0.5" y="17" width="8" height="6" rx="2.4"/>
    <rect x="31.5" y="17" width="8" height="6" rx="2.4"/>
    <rect x="17" y="0.5" width="6" height="8" rx="2.4" transform="rotate(45 20 20)"/>
    <rect x="17" y="31.5" width="6" height="8" rx="2.4" transform="rotate(45 20 20)"/>
    <rect x="0.5" y="17" width="8" height="6" rx="2.4" transform="rotate(45 20 20)"/>
    <rect x="31.5" y="17" width="8" height="6" rx="2.4" transform="rotate(45 20 20)"/>
    <circle cx="20" cy="20" r="12.5"/>
  </g>
  <circle cx="20" cy="20" r="6.5" fill="#fff"/>
  <ellipse cx="15.5" cy="14.5" rx="5.5" ry="3.4" fill="#fff" opacity="0.3" transform="rotate(-35 15.5 14.5)"/>
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

  h.innerHTML = `
    <span class="brand"><svg viewBox="0 0 512 512"><defs><linearGradient id="nrleaf" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#7CC96A"/><stop offset="1" stop-color="#3E9E52"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="#2BB5A0"/><g fill="none" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="13"><ellipse cx="256" cy="396" rx="148" ry="36"/><ellipse cx="256" cy="396" rx="86" ry="21"/></g><path d="M256 68 C168 68 100 136 100 222 C100 316 202 398 256 434 C310 398 412 316 412 222 C412 136 344 68 256 68 Z" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linejoin="round"/><g transform="translate(252 210) scale(0.55) translate(-256 -288)"><path d="M256 416c-72-48-136-102-136-176 0-45 34-80 78-80 28 0 48 13 58 32 10-19 30-32 58-32 44 0 78 35 78 80 0 74-64 128-136 176z" fill="#FFFFFF"/></g><g transform="translate(288 210) rotate(35)"><path d="M0 -40 C26 -24 28 10 0 40 C-28 10 -26 -24 0 -40 Z" fill="url(#nrleaf)"/><path d="M0 36 L-9 60" stroke="#3E9E52" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M0 -30 L0 32 M0 -16 L13 -25 M0 -16 L-13 -25 M0 2 L15 -7 M0 2 L-15 -7 M0 18 L12 9 M0 18 L-12 9" stroke="#FFFFFF" stroke-width="3.5" fill="none" stroke-linecap="round"/></g></svg>NutriRuta</span>
    <div class="row" style="gap:2px">
      ${mostrarStats ? `
        <div class="header-stats">
          <button class="header-stat" id="hs-racha" aria-label="Tus Días en Ruta"><span class="icon streak-flame ${racha > 0 ? 'lit' : 'out'}">🔥</span>${racha}</button>
          <button class="header-stat" id="hs-gemas" aria-label="Tus gemas"><span class="icon">💎</span>${gemas}</button>
          <button class="header-stat" id="hs-escudos" aria-label="Tus Pausas de Ruta"><span class="icon">🛡️</span>${escudos}</button>
        </div>` : ''}
      <button class="icon-btn" data-go="settings" aria-label="${t('Ajustes')}">${GEAR_ICON}</button>
    </div>`;
  h.querySelector('[data-go]').addEventListener('click', () => navigate('settings'));

  if (mostrarStats) {
    const etapa = broteStage(racha);
    const mejor = state.racha?.mejor || 0;
    attachStatTooltip(h.querySelector('#hs-racha'), `
      <div class="row" style="gap:8px; align-items:center">
        ${broteBadge(etapa, { size: 34, premium: isPremium() })}
        <strong>🔥 ${racha} Día${racha === 1 ? '' : 's'} en Ruta</strong>
      </div>
      <p class="small muted mt" style="margin-top:4px">${etapa.label} — tu Brote de Ruta crece con tu constancia.</p>
      <p class="small muted" style="margin-top:2px">Mejor Ruta: ${mejor} día${mejor === 1 ? '' : 's'}</p>`);
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
  const closeFn = () => backdrop.remove();
  close.addEventListener('click', closeFn);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeFn(); });
  modal.appendChild(close);
  contentBuilder(modal, closeFn);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  return closeFn;
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
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
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

  if (isInviteLink && session) {
    navigate('resetPassword');
  } else {
    if (session) await initCloud();
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
