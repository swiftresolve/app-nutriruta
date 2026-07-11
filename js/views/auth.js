// Inicio de sesión y registro (Supabase Auth: JWT + refresh token rotativo).
import { signIn, signUp } from '../supabase-client.js';
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

export function renderAuth(container) {
  let mode = 'login';

  function draw() {
    container.innerHTML = '';
    const view = document.createElement('div');
    view.innerHTML = `
      <div class="splash" style="min-height:22vh">
        <div class="splash-logo">🌿</div>
        <h1>NutriRuta</h1>
        <p>Tu ruta hacia hábitos saludables, paso a paso.</p>
      </div>
      <div class="card">
        <h2>${mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h2>
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
          <p class="small" id="a-error" style="color:var(--red);min-height:1.2em" role="alert"></p>
          <button class="btn full" type="submit">${mode === 'login' ? 'Entrar' : 'Registrarme'}</button>
        </form>
        <p class="center mt small">
          ${mode === 'login' ? '¿Primera vez aquí?' : '¿Ya tienes cuenta?'}
          <button class="link-btn" id="a-toggle">${mode === 'login' ? 'Crea tu cuenta' : 'Inicia sesión'}</button>
        </p>
      </div>
      <div class="legal-note">NutriRuta es una guía de autoayuda: no reemplaza la atención de un profesional de salud.</div>`;

    // Estilo de inputs (una vez)
    if (!document.getElementById('auth-style')) {
      const st = document.createElement('style');
      st.id = 'auth-style';
      st.textContent = '.auth-input{width:100%;padding:12px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit;margin:6px 0 12px}';
      document.head.appendChild(st);
    }

    view.querySelector('#a-toggle').addEventListener('click', () => {
      mode = mode === 'login' ? 'signup' : 'login';
      draw();
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
          resetState();
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
