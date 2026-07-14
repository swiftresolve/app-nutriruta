// Pantalla que aparece al hacer clic en el enlace de invitación (tras
// comprar en Hotmart sin tener cuenta aún) o de "olvidé mi contraseña".
// El SDK de Supabase ya estableció la sesión leyendo el enlace
// (detectSessionInUrl: true en supabase-client.js) — aquí solo falta
// pedir la contraseña nueva.
import { supabase } from '../supabase-client.js';
import { initCloud, getState } from '../store.js';
import { navigate, toast, setAuthed } from '../app.js';
import { MIN_PASSWORD, passwordIssues } from './auth.js';

export function renderResetPassword(container) {
  // Puede ser la primera pantalla que se renderiza (llega directo desde el
  // enlace del correo, sin pasar nunca por auth.js), así que el estilo de
  // los inputs no puede depender de que auth.js ya lo haya inyectado.
  if (!document.getElementById('auth-style')) {
    const st = document.createElement('style');
    st.id = 'auth-style';
    st.textContent = '.auth-input{width:100%;padding:12px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit;margin:6px 0 12px}';
    document.head.appendChild(st);
  }

  container.innerHTML = `
    <div class="splash" style="min-height:22vh">
      <div class="splash-logo"><svg viewBox="0 0 512 512"><defs><linearGradient id="nrleaf" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#7CC96A"/><stop offset="1" stop-color="#3E9E52"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="#2BB5A0"/><g fill="none" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="13"><ellipse cx="256" cy="396" rx="148" ry="36"/><ellipse cx="256" cy="396" rx="86" ry="21"/></g><path d="M256 68 C168 68 100 136 100 222 C100 316 202 398 256 434 C310 398 412 316 412 222 C412 136 344 68 256 68 Z" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linejoin="round"/><g transform="translate(252 210) scale(0.55) translate(-256 -288)"><path d="M256 416c-72-48-136-102-136-176 0-45 34-80 78-80 28 0 48 13 58 32 10-19 30-32 58-32 44 0 78 35 78 80 0 74-64 128-136 176z" fill="#FFFFFF"/></g><g transform="translate(288 210) rotate(35)"><path d="M0 -40 C26 -24 28 10 0 40 C-28 10 -26 -24 0 -40 Z" fill="url(#nrleaf)"/><path d="M0 36 L-9 60" stroke="#3E9E52" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M0 -30 L0 32 M0 -16 L13 -25 M0 -16 L-13 -25 M0 2 L15 -7 M0 2 L-15 -7 M0 18 L12 9 M0 18 L-12 9" stroke="#FFFFFF" stroke-width="3.5" fill="none" stroke-linecap="round"/></g></svg></div>
      <h1>NutriRuta</h1>
      <p>Ya casi está lista tu cuenta.</p>
    </div>
    <div class="card">
      <h2>Crea tu contraseña</h2>
      <p class="small muted mt">Tu compra ya está confirmada. Con esto activas tu acceso.</p>
      <form novalidate>
        <label class="muted small" for="rp-pass">Nueva contraseña</label>
        <input id="rp-pass" type="password" required minlength="${MIN_PASSWORD}" autocomplete="new-password" class="auth-input">
        <p class="small muted">Mínimo ${MIN_PASSWORD} caracteres, con letras y números.</p>
        <p class="small" id="rp-error" style="color:var(--red);min-height:1.2em" role="alert"></p>
        <button class="btn full" type="submit">Guardar y entrar</button>
      </form>
    </div>
    <div class="legal-note">Si este enlace ya expiró, entra con "¿Olvidaste tu contraseña?" desde la pantalla de inicio de sesión.</div>`;

  const form = container.querySelector('form');
  const errEl = container.querySelector('#rp-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = container.querySelector('#rp-pass').value;
    const issues = passwordIssues(pass);
    if (issues.length) { errEl.textContent = 'Contraseña insegura: ' + issues.join(', ') + '.'; return; }

    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Un momento…';
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
      setAuthed(true);
      await initCloud();
      history.replaceState(null, '', window.location.pathname);
      toast('¡Contraseña creada! Bienvenida a NutriRuta 🌿');
      navigate(getState().onboarded ? 'dashboard' : 'quiz');
    } catch (err) {
      errEl.textContent = 'El enlace expiró o ya se usó. Pide uno nuevo con "¿Olvidaste tu contraseña?".';
      btn.disabled = false;
      btn.textContent = 'Guardar y entrar';
    }
  });
}
