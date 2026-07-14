// Router mínimo + arranque con puerta de autenticación.
import { getState, initCloud, resetState } from './store.js';
import { getSession, supabase } from './supabase-client.js';
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
import { maybeShowCheckin } from './views/checkin.js';

const app = document.getElementById('app');
const nav = document.getElementById('bottom-nav');

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
  resetPassword: renderResetPassword
};

const PUBLIC_ROUTES = ['auth', 'resetPassword'];
let authed = false;

export function setAuthed(v) { authed = v; }

export function navigate(route, params = {}) {
  if (!authed && !PUBLIC_ROUTES.includes(route)) route = 'auth';
  const render = ROUTES[route] || renderDashboard;
  app.innerHTML = '';
  window.scrollTo(0, 0);
  render(app, params);
  if (route === 'dashboard') maybeShowCheckin();

  const showNav = route !== 'quiz' && route !== 'auth' && route !== 'resetPassword';
  nav.classList.toggle('hidden', !showNav);
  nav.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.route === route);
  });
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

// Cabecera común de las vistas principales.
export function header(container) {
  const h = document.createElement('div');
  h.className = 'app-header';
  h.innerHTML = `
    <span class="brand"><svg viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#2BB5A0"/><path d="M256 84 C176 84 116 146 116 226 C116 322 256 428 256 428 C256 428 396 322 396 226 C396 146 336 84 256 84 Z" fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linejoin="round"/><g transform="translate(256 222) scale(0.62) translate(-256 -288)"><path d="M256 416c-72-48-136-102-136-176 0-45 34-80 78-80 28 0 48 13 58 32 10-19 30-32 58-32 44 0 78 35 78 80 0 74-64 128-136 176z" fill="#FFFFFF"/></g><g transform="translate(256 212) rotate(18)"><path d="M0 -36 C24 -21 26 9 0 36 C-26 9 -24 -21 0 -36 Z" fill="#3BAE5C"/><path d="M0 -27 L0 28 M0 -12 L11 -20 M0 -12 L-11 -20 M0 6 L12 -2 M0 6 L-12 -2" stroke="#FFFFFF" stroke-width="4.5" fill="none" stroke-linecap="round"/></g></svg>NutriRuta</span>
    <button class="icon-btn" data-go="settings" aria-label="Ajustes">⚙️</button>`;
  h.querySelector('[data-go]').addEventListener('click', () => navigate('settings'));
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
if ('serviceWorker' in navigator) {
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

  if (isInviteLink && session) {
    navigate('resetPassword');
  } else {
    if (session) await initCloud();
    navigate(!authed ? 'auth' : getState().onboarded ? 'dashboard' : 'quiz');
  }

  supabase.auth.onAuthStateChange((event) => {
    // Al cerrar sesión, nunca dejar el progreso de esta cuenta en el
    // navegador: si alguien más entra o se registra aquí después, no debe
    // heredar racha, misión ni plan de 7 días de la sesión anterior.
    if (event === 'SIGNED_OUT') { authed = false; resetState(); navigate('auth'); }
    if (event === 'SIGNED_IN' && !authed) { authed = true; }
  });
})();
