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
      <div class="splash-logo">🌿</div>
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
