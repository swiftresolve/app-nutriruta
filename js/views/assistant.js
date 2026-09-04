// Pregúntale a tu guía: asistente conversacional Premium.
// Cuota, verificación de plan y la llamada a la IA viven en el servidor
// (Edge Function ai-assistant) — aquí solo se pinta el chat y se envía.
import { isPremium, getState, setState, sanaApertura, esc, agregarMemoria, eliminarMemoria, MEMORIA_MAX } from '../store.js';
import { fetchGuideHistory, askGuide } from '../supabase-client.js';
import { header, navigate, toast, susanaName, openModal } from '../app.js';
import { SUSANA_TONOS } from '../data/susanaTonos.js';

export function renderAssistant(container) {
  if (!isPremium()) {
    header(container);
    const lock = document.createElement('div');
    lock.className = 'card center';
    lock.innerHTML = `
      <div style="font-size:2.6rem">💬</div>
      <h2>${susanaName()}, tu guía</h2>
      <p class="mt">Un espacio para resolver dudas puntuales de nutrición y hábitos, con el contexto de tu perfil — como tener acompañamiento a la mano. Es parte del <strong>plan Premium</strong>.</p>
      <button class="btn accent full mt">Ver planes Premium</button>`;
    lock.querySelector('.btn').addEventListener('click', () => navigate('plans'));
    container.appendChild(lock);
    return;
  }

  // Sin el banner común (marca + racha/gemas/escudos + ajustes, ver
  // header() en app.js) -- dentro del chat esa barra solo quitaba
  // espacio y no aportaba nada de la conversación. En su lugar, el
  // propio header de SuSana (avatar + nombre) queda fijo arriba
  // (position:sticky, ver .chat-header en styles.css) mientras el chat
  // hace scroll debajo.
  const chatHeader = document.createElement('div');
  chatHeader.className = 'chat-header';
  chatHeader.innerHTML = `
    <span class="sana-avatar chat-header-avatar">🌿</span>
    <div class="chat-header-info">
      <strong>${susanaName()}</strong>
      <span class="small muted" id="chatQuota">Cargando…</span>
    </div>
    <button type="button" class="icon-btn" id="chatPersonalizar" aria-label="Personalizar a SuSana">⚙️</button>`;
  container.appendChild(chatHeader);
  chatHeader.querySelector('#chatPersonalizar').addEventListener('click', () => abrirPersonalizarSuSana());

  const aviso = document.createElement('p');
  aviso.className = 'small muted chat-disclaimer';
  aviso.textContent = 'No reemplaza a tu médico o nutricionista — ante señales de alarma, busca atención profesional de inmediato.';
  container.appendChild(aviso);

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

  // inputRow es position:fixed (ver styles.css) -- queda fuera del flujo
  // normal, así que sin este espaciador el último mensaje del chat
  // quedaría tapado detrás de él.
  const spacer = document.createElement('div');
  spacer.className = 'chat-input-spacer';
  container.appendChild(spacer);

  const log = chatCard.querySelector('#chatLog');
  const quotaEl = chatHeader.querySelector('#chatQuota');
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
        addBubble('system', `¡Hola! Soy SuSana 🌿 ${sanaApertura()}`);
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

// "Personalizar a SuSana": elegir el tono con una frase de ejemplo en vivo
// (como el selector de tono de Fitia Coach, pero con las frases reales de
// SuSana) + acceso a Memorias -- inspirado en "Personalizar Coach" de
// Fitia, sin nada de calorías ni macros, que no aplica aquí.
function abrirPersonalizarSuSana() {
  openModal((modal, closeFn) => {
    const wrap = document.createElement('div');
    modal.appendChild(wrap);

    function pintar() {
      const user = getState().user;
      const tonoActual = SUSANA_TONOS.find((t) => t.id === (user.tonoSusana || 'calida')) || SUSANA_TONOS[0];
      const memorias = user.memorias || [];
      wrap.innerHTML = `
        <h2>⚙️ Personalizar a ${susanaName()}</h2>
        <p class="small muted mt">Define el tono con el que te habla. Nunca usa culpa ni regaños, solo cambia el estilo.</p>
        <div class="chips mt" id="pz-tonos">
          ${SUSANA_TONOS.map((t) => `<button type="button" class="chip${t.id === tonoActual.id ? ' selected' : ''}" data-tono="${t.id}">${t.emoji} ${t.nombre}</button>`).join('')}
        </div>
        <p class="small mt" style="font-style:italic;border-left:4px solid var(--secondary);padding-left:10px" id="pz-ejemplo">"${esc(tonoActual.ejemplo)}"</p>
        <button type="button" class="setting-row mt" id="pz-memorias" style="padding:10px 0;border-top:1px solid var(--border)">
          <span class="setting-row-icon">🧠</span>
          <span class="setting-row-label">Memorias (${memorias.length}/${MEMORIA_MAX})</span>
          <span class="setting-row-chevron">›</span>
        </button>`;

      wrap.querySelectorAll('#pz-tonos .chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          setState({ user: { ...getState().user, tonoSusana: btn.dataset.tono } });
          pintar();
        });
      });
      // Cierra este modal y abre Memorias encima -- más simple que anidar
      // dos modales con su propio ciclo de vida cada uno; al cerrar
      // Memorias, un toque en el engranaje vuelve a traer esta pantalla.
      wrap.querySelector('#pz-memorias').addEventListener('click', () => { closeFn(); abrirMemorias(); });
    }

    pintar();
  });
}

// Memorias: notas puntuales que SuSana "recuerda" entre conversaciones,
// además del contexto libre que ya existía (user.contextoSusana) -- esta
// versión es una lista corta y editable, como en Fitia, en vez de un solo
// bloque de texto largo.
function abrirMemorias() {
  openModal((modal) => {
    const wrap = document.createElement('div');
    modal.appendChild(wrap);

    function pintar() {
      const memorias = getState().user.memorias || [];
      const lleno = memorias.length >= MEMORIA_MAX;
      wrap.innerHTML = `
        <h2>🧠 Memorias</h2>
        <p class="small muted mt">${memorias.length}/${MEMORIA_MAX} creadas. ${susanaName()} las tiene en cuenta en cada respuesta.</p>
        <div class="mt" id="mem-lista"></div>
        <textarea id="mem-nueva" class="auth-input mt" rows="2" maxlength="200" placeholder="Ej: hace meses no hago ejercicio, quiero retomar con disciplina" ${lleno ? 'disabled' : ''}></textarea>
        <button class="btn ghost full mt" id="mem-agregar" ${lleno ? 'disabled' : ''}>${lleno ? 'Llegaste al máximo de 10' : '+ Agregar'}</button>`;
      const lista = wrap.querySelector('#mem-lista');
      if (!memorias.length) {
        lista.innerHTML = '<p class="small muted">Aún no has guardado ninguna.</p>';
      } else {
        for (const m of memorias) {
          const row = document.createElement('div');
          row.className = 'habit';
          row.innerHTML = `<label style="flex:1">${esc(m.texto)}</label><button type="button" class="link-btn small" aria-label="Eliminar">🗑️</button>`;
          row.querySelector('button').addEventListener('click', () => { eliminarMemoria(m.id); pintar(); });
          lista.appendChild(row);
        }
      }
      wrap.querySelector('#mem-agregar').addEventListener('click', () => {
        const val = wrap.querySelector('#mem-nueva').value;
        if (!agregarMemoria(val)) { toast('Escribe algo, o ya llegaste al máximo de 10.'); return; }
        pintar();
      });
    }

    pintar();
  });
}
