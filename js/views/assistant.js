// Pregúntale a tu guía: asistente conversacional Premium.
// Cuota, verificación de plan y la llamada a la IA viven en el servidor
// (Edge Function ai-assistant) — aquí solo se pinta el chat y se envía.
import { isPremium, getState } from '../store.js';
import { fetchGuideHistory, askGuide } from '../supabase-client.js';
import { header, navigate, toast } from '../app.js';

export function renderAssistant(container) {
  header(container);

  if (!isPremium()) {
    const lock = document.createElement('div');
    lock.className = 'card center';
    lock.innerHTML = `
      <div style="font-size:2.6rem">💬</div>
      <h2>Sana, tu guía</h2>
      <p class="mt">Un espacio para resolver dudas puntuales de nutrición y hábitos, con el contexto de tu perfil — como tener acompañamiento a la mano. Es parte del <strong>plan Premium</strong>.</p>
      <button class="btn accent full mt">Ver planes Premium</button>`;
    lock.querySelector('.btn').addEventListener('click', () => navigate('plans'));
    container.appendChild(lock);
    return;
  }

  const hero = document.createElement('div');
  hero.className = 'card';
  hero.innerHTML = `
    <h2>💬 Sana, tu guía</h2>
    <p class="small mt">Pregúntale lo que quieras sobre tu alimentación, tus síntomas o tus antojos. Tiene en cuenta tu perfil, pero recuerda: <strong>no reemplaza a tu médico o nutricionista</strong>, y ante señales de alarma, busca atención profesional de inmediato.</p>
    <p class="chat-quota mt" id="chatQuota">Cargando…</p>`;
  container.appendChild(hero);

  const chatCard = document.createElement('div');
  chatCard.className = 'card';
  chatCard.innerHTML = '<div class="chat-log" id="chatLog"></div>';
  container.appendChild(chatCard);

  const inputRow = document.createElement('div');
  inputRow.className = 'chat-input-row';
  inputRow.innerHTML = `
    <textarea id="chatInput" rows="1" maxlength="600" placeholder="Escribe tu pregunta…"></textarea>
    <button class="btn accent" id="chatSend" aria-label="Enviar">➤</button>`;
  container.appendChild(inputRow);

  const log = chatCard.querySelector('#chatLog');
  const quotaEl = hero.querySelector('#chatQuota');
  const input = inputRow.querySelector('#chatInput');
  const sendBtn = inputRow.querySelector('#chatSend');

  let limitReached = false;

  // .chat-log no tiene scroll propio (crece con la página completa), así que
  // "hacer scroll" real es desplazar el elemento nuevo a la vista, no mover
  // log.scrollTop (eso no hacía nada — era la causa de que las respuestas
  // "no se vieran" hasta buscarlas manualmente).
  function scrollToView(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function addDivider(text) {
    const d = document.createElement('div');
    d.className = 'chat-divider';
    d.innerHTML = `<span>${text}</span>`;
    log.appendChild(d);
    return d;
  }

  function addBubble(role, text) {
    const b = document.createElement('div');
    b.className = `chat-msg ${role}`;
    b.textContent = text;
    log.appendChild(b);
    scrollToView(b);
    return b;
  }

  function setQuota(used, limit) {
    quotaEl.textContent = `${used}/${limit} mensajes este mes`;
    limitReached = used >= limit;
    sendBtn.disabled = limitReached;
    input.disabled = limitReached;
    if (limitReached) input.placeholder = 'Alcanzaste tu límite de este mes.';
  }

  async function loadHistory() {
    try {
      const data = await fetchGuideHistory();
      log.innerHTML = '';
      if (!data.history.length) {
        addBubble('system', '¡Hola! Soy Sana 🌿 Escribe tu primera pregunta cuando quieras. Por ejemplo: "tengo antojo de dulce a las 4pm, ¿qué hago?"');
      } else {
        for (const m of data.history) addBubble(m.role, m.content);
      }
      setQuota(data.usedCount, data.limit);
    } catch (e) {
      addBubble('system', 'No pudimos cargar tu historial. Revisa tu conexión.');
    }
  }

  async function send() {
    const text = input.value.trim();
    if (!text || limitReached) return;
    input.value = '';
    input.style.height = 'auto';
    addBubble('user', text);
    sendBtn.disabled = true;
    input.disabled = true;

    const divider = addDivider('Nuevo mensaje');
    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(typing);
    scrollToView(typing);

    try {
      const data = await askGuide(text);
      typing.remove();
      const reply = addBubble('assistant', data.reply);
      setQuota(data.usedCount, data.limit);
      // El divisor solo marca "hasta aquí llegó lo nuevo" mientras esta
      // respuesta sigue siendo la más reciente; deja de tener sentido en
      // cuanto la usuaria manda la siguiente pregunta.
      setTimeout(() => divider.remove(), 4000);
      scrollToView(reply);
    } catch (e) {
      typing.remove();
      divider.remove();
      if (e.code === 'cuota_agotada') {
        const fecha = e.resetDate ? new Date(e.resetDate).toLocaleDateString('es', { day: 'numeric', month: 'long' }) : 'el próximo mes';
        const nombre = getState().user?.nombre;
        addBubble('assistant', `Por hoy llegamos hasta aquí${nombre ? ', ' + nombre : ''} — ya usamos tus 25 mensajes de este mes 💚 Ha sido un gusto acompañarte. Nos vemos de nuevo el ${fecha}; mientras tanto sigo aquí en la app, en tu menú y tu progreso de cada día. ¡Cuídate mucho!`);
        setQuota(25, 25);
      } else if (e.code === 'premium_requerido') {
        toast('Tu plan Premium ya no está activo.');
        navigate('plans');
      } else {
        addBubble('system', e.message || 'No se pudo enviar tu pregunta. Intenta de nuevo.');
        sendBtn.disabled = false;
        input.disabled = false;
      }
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 90) + 'px';
  });

  loadHistory();
}
