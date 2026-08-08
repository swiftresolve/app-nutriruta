// Prompt de notificaciones en el momento de valor (no enterrado en
// Ajustes): aparece justo cuando ya hay algo que proteger — la primera
// racha, y de nuevo si la persona lo pospuso y llegó a 3 días. Igual que
// el check-in, es una tarjeta descartable del dashboard, nunca un modal.
import { getState, setState } from '../store.js';
import { pushSupported, enablePush } from '../push.js';
import { toast } from '../app.js';

export function notifPromptVisible() {
  if (!pushSupported()) return false;
  // 'default' = nunca se le preguntó al navegador; si ya es 'granted' o
  // 'denied', preguntar de nuevo aquí no cambia nada (y sería molesto).
  if (Notification.permission !== 'default') return false;
  const { racha, notifPromptEstado } = getState();
  const actual = racha?.actual || 0;
  if (!notifPromptEstado && actual >= 1) return true;
  if (notifPromptEstado === 'pospuesto_1' && actual >= 3) return true;
  return false;
}

export function renderNotifPrompt(container, onChange) {
  const { user } = getState();
  const card = document.createElement('div');
  card.className = 'card';
  card.style.borderLeft = '4px solid var(--accent)';
  card.innerHTML = `
    <div class="spread">
      <span class="small" style="font-weight:700">🔔 ¿Te avisamos para seguir tu Ruta cada día?</span>
      <button class="icon-btn" id="np-cerrar" aria-label="Cerrar">✕</button>
    </div>
    <p class="small mt">${user.nombre ? esc(user.nombre) + ', un' : 'Un'} aviso a tiempo te ayuda a no dejar pasar el momento — sin presión, a tu ritmo.</p>
    <button class="btn accent sm mt" id="np-activar">🔔 Sí, avísame</button>`;
  container.appendChild(card);

  card.querySelector('#np-cerrar').addEventListener('click', () => {
    posponer();
    if (onChange) onChange();
  });
  card.querySelector('#np-activar').addEventListener('click', async () => {
    const btn = card.querySelector('#np-activar');
    btn.disabled = true;
    btn.textContent = 'Activando…';
    try {
      await enablePush();
      toast('¡Notificaciones activadas! 🔔');
    } catch (e) {
      toast(e.message || 'No se pudo activar. Puedes intentarlo luego en Ajustes.');
    }
    setState({ notifPromptEstado: 'terminado' });
    if (onChange) onChange();
  });
}

function posponer() {
  const { notifPromptEstado } = getState();
  setState({ notifPromptEstado: notifPromptEstado === 'pospuesto_1' ? 'terminado' : 'pospuesto_1' });
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
