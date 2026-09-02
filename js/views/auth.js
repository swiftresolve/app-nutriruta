// Inicio de sesión y registro (Supabase Auth: JWT + refresh token rotativo).
import { signIn, signUp, requestPasswordReset } from '../supabase-client.js';
import { initCloud, getState, resetState } from '../store.js';
import { navigate, toast, setAuthed } from '../app.js';

export const MIN_PASSWORD = 8;

export function passwordIssues(pw) {
  const issues = [];
  if (pw.length < MIN_PASSWORD) issues.push(`mínimo ${MIN_PASSWORD} caracteres`);
  if (!/[a-záéíóúñ]/i.test(pw)) issues.push('al menos una letra');
  if (!/\d/.test(pw)) issues.push('al menos un número');
  return issues;
}

const EYE_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.6 20.6 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a20.5 20.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

// El ojito para mostrar/ocultar la contraseña escrita — el input no lo
// trae de fábrica en ningún navegador. Envuelve el <input type="password">
// que ya está en el DOM (no rearma el HTML del formulario) y alterna su
// type entre password/text al tocarlo.
export function attachPasswordToggle(input) {
  const wrap = document.createElement('div');
  wrap.className = 'pw-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pw-toggle';
  btn.setAttribute('aria-label', 'Mostrar contraseña');
  btn.innerHTML = EYE_ICON;
  wrap.appendChild(btn);
  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = show ? EYE_OFF_ICON : EYE_ICON;
    btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    input.focus({ preventScroll: true });
  });
}

export function renderAuth(container, params = {}) {
  // Por defecto entra en login (ej. si expira la sesión en cualquier otra
  // pantalla) -- pero justo al terminar el quiz de onboarding todavía no
  // existe ninguna cuenta, así que ese flujo pide explícitamente el modo
  // registro (ver quiz.js) para no confundir a quien nunca inició sesión.
  let mode = params.mode === 'signup' ? 'signup' : 'login';

  function draw() {
    container.innerHTML = '';
    const view = document.createElement('div');
    view.innerHTML = `
      <div class="splash" style="min-height:22vh">
        <div class="splash-logo"><svg viewBox="0 0 512 512"><defs><linearGradient id="nrleaf" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#7CC96A"/><stop offset="1" stop-color="#3E9E52"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="#2BB5A0"/><g fill="none" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="13"><ellipse cx="256" cy="396" rx="148" ry="36"/><ellipse cx="256" cy="396" rx="86" ry="21"/></g><path d="M256 68 C168 68 100 136 100 222 C100 316 202 398 256 434 C310 398 412 316 412 222 C412 136 344 68 256 68 Z" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linejoin="round"/><g transform="translate(252 210) scale(0.55) translate(-256 -288)"><path d="M256 416c-72-48-136-102-136-176 0-45 34-80 78-80 28 0 48 13 58 32 10-19 30-32 58-32 44 0 78 35 78 80 0 74-64 128-136 176z" fill="#FFFFFF"/></g><g transform="translate(288 210) rotate(35)"><path d="M0 -40 C26 -24 28 10 0 40 C-28 10 -26 -24 0 -40 Z" fill="url(#nrleaf)"/><path d="M0 36 L-9 60" stroke="#3E9E52" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M0 -30 L0 32 M0 -16 L13 -25 M0 -16 L-13 -25 M0 2 L15 -7 M0 2 L-15 -7 M0 18 L12 9 M0 18 L-12 9" stroke="#FFFFFF" stroke-width="3.5" fill="none" stroke-linecap="round"/></g></svg></div>
        <h1>NutriRuta</h1>
        <p>Tu ruta hacia hábitos saludables, paso a paso.</p>
      </div>
      <div class="card">
        <h2 class="center" style="justify-content:center">${mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h2>
        <form novalidate>
          ${mode === 'signup' ? `
          <label class="muted small" for="a-nombre">Nombre o alias (opcional)</label>
          <input id="a-nombre" type="text" maxlength="60" autocomplete="nickname" class="auth-input">` : ''}
          <label class="muted small" for="a-email">Correo electrónico</label>
          <input id="a-email" type="email" required autocomplete="email" class="auth-input" inputmode="email">
          <label class="muted small" for="a-pass">Contraseña</label>
          <input id="a-pass" type="password" required minlength="${MIN_PASSWORD}"
            autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" class="auth-input">
          ${mode === 'signup' ? '<p class="small muted">Mínimo 8 caracteres, con letras y números.</p>' : ''}
          ${mode === 'login' ? '<p class="small" style="margin:-6px 0 6px"><button type="button" class="link-btn small" id="a-forgot">¿Olvidaste tu contraseña?</button></p>' : ''}
          <p class="small" id="a-error" style="color:var(--red);min-height:1.2em" role="alert"></p>
          <p class="small" id="a-info" style="color:var(--primary-dark);min-height:1.2em"></p>
          <button class="btn full" type="submit">${mode === 'login' ? 'Entrar' : 'Registrarme'}</button>
        </form>
        <p class="center mt small">
          ${mode === 'login' ? '¿Primera vez aquí?' : '¿Ya tienes cuenta?'}
          <button class="link-btn" id="a-toggle">${mode === 'login' ? 'Crea tu cuenta' : 'Inicia sesión'}</button>
        </p>
      </div>
      <div class="legal-note">NutriRuta es una guía de autoayuda: no reemplaza la atención de un profesional de salud.</div>`;

    attachPasswordToggle(view.querySelector('#a-pass'));

    view.querySelector('#a-toggle').addEventListener('click', () => {
      mode = mode === 'login' ? 'signup' : 'login';
      draw();
    });

    view.querySelector('#a-forgot')?.addEventListener('click', async () => {
      const errEl = view.querySelector('#a-error');
      const infoEl = view.querySelector('#a-info');
      const email = view.querySelector('#a-email').value.trim().toLowerCase();
      errEl.textContent = ''; infoEl.textContent = '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = 'Escribe primero tu correo arriba, para saber a dónde enviarte el enlace.';
        return;
      }
      const link = view.querySelector('#a-forgot');
      link.disabled = true;
      try {
        await requestPasswordReset(email);
      } catch { /* nunca revelamos si el correo existe o no */ }
      infoEl.textContent = `Si ${email} tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa tu correo (y spam).`;
      link.disabled = false;
    });

    view.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = view.querySelector('#a-error');
      const email = view.querySelector('#a-email').value.trim().toLowerCase();
      const pass = view.querySelector('#a-pass').value;
      errEl.textContent = '';

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Escribe un correo válido.'; return; }
      if (mode === 'signup') {
        const issues = passwordIssues(pass);
        if (issues.length) { errEl.textContent = 'Contraseña insegura: ' + issues.join(', ') + '.'; return; }
      }

      const btn = view.querySelector('.btn');
      btn.disabled = true; btn.textContent = 'Un momento…';
      try {
        if (mode === 'signup') {
          const nombre = (view.querySelector('#a-nombre')?.value || '').trim();
          const { data, error } = await signUp(email, pass, nombre);
          if (error) throw error;
          // Una cuenta nueva nunca debe heredar progreso de una sesión anterior
          // en este mismo navegador (racha, misión, plan de 7 días, onboarded…).
          // Sin esto, initCloud() podría subir ese estado viejo al perfil nuevo.
          // EXCEPCIÓN: si onboarded ya es true sin haber sesión todavía, es el
          // quiz que se acaba de responder como invitada, justo antes de este
          // registro — no es una sesión anterior ajena, es lo que este mismo
          // registro debe guardar. Se conserva; initCloud() lo migra a la
          // cuenta nueva (ver store.js).
          if (!getState().onboarded) resetState();
          if (!data.session) {
            container.innerHTML = `
              <div class="card center" style="margin-top:20vh">
                <div style="font-size:3rem">📬</div>
                <h2>Confirma tu correo</h2>
                <p class="mt">Te enviamos un enlace a <strong>${email.replace(/</g, '&lt;')}</strong>. Ábrelo para activar tu cuenta y luego inicia sesión.</p>
                <button class="btn full mt" id="a-back">Volver a iniciar sesión</button>
              </div>`;
            container.querySelector('#a-back').addEventListener('click', () => { mode = 'login'; draw(); });
            return;
          }
        } else {
          const { error } = await signIn(email, pass);
          if (error) throw error;
        }
        setAuthed(true);
        await initCloud();
        toast('¡Qué gusto tenerte en NutriRuta! 🌿');
        navigate(getState().onboarded ? 'dashboard' : 'quiz');
      } catch (err) {
        errEl.textContent = friendlyError(err);
      } finally {
        btn.disabled = false;
        btn.textContent = mode === 'login' ? 'Entrar' : 'Registrarme';
      }
    });

    container.appendChild(view);
  }

  draw();
}

function friendlyError(err) {
  const msg = (err && err.message) || '';
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/already registered/i.test(msg)) return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  if (/email not confirmed/i.test(msg)) return 'Debes confirmar tu correo antes de entrar. Revisa tu bandeja.';
  if (/password should be/i.test(msg)) return 'La contraseña no cumple los requisitos mínimos.';
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  if (/failed to fetch|network/i.test(msg)) return 'Sin conexión. Verifica tu internet e inténtalo de nuevo.';
  return 'No se pudo completar. Inténtalo de nuevo.';
}
