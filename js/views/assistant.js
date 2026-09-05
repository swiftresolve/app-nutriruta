// Pregúntale a tu guía: asistente conversacional Premium.
// Cuota, verificación de plan y la llamada a la IA viven en el servidor
// (Edge Function ai-assistant) — aquí solo se pinta el chat y se envía.
import { isPremium, getState, setState, sanaApertura, esc, agregarMemoria, eliminarMemoria, MEMORIA_MAX } from '../store.js';
import { fetchGuideHistory, askGuide, listGuideConversations, newGuideConversation } from '../supabase-client.js';
import { header, navigate, toast, susanaName, openModal, GEAR_ICON, PENCIL_ICON } from '../app.js';
import { SUSANA_TONOS } from '../data/susanaTonos.js';

// Ícono de menú hamburguesa -- 3 líneas simples, mismo lenguaje visual
// que el resto de íconos propios de la app (GEAR_ICON, SEARCH_ICON en
// app.js): trazo sin relleno, no emoji.
const MENU_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;

const CONTEXTO_MAX = 300;

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
  let conversationId = null;

  const chatHeader = document.createElement('div');
  chatHeader.className = 'chat-header';
  chatHeader.innerHTML = `
    <button type="button" class="icon-btn plain" id="chatHistorial" aria-label="Historial de conversaciones">${MENU_ICON}</button>
    <span class="sana-avatar chat-header-avatar">🌿</span>
    <div class="chat-header-info">
      <strong>${susanaName()}</strong>
      <span class="small muted" id="chatQuota">Cargando…</span>
    </div>
    <button type="button" class="icon-btn plain" id="chatPersonalizar" aria-label="Personalizar a SuSana">${GEAR_ICON}</button>`;
  container.appendChild(chatHeader);
  chatHeader.querySelector('#chatPersonalizar').addEventListener('click', () => abrirPersonalizarSuSana());
  chatHeader.querySelector('#chatHistorial').addEventListener('click', () => {
    abrirHistorialSuSana(conversationId, {
      onElegir: (id) => loadHistory(id),
      onNueva: async () => {
        const nueva = await newGuideConversation();
        conversationId = nueva;
        log.innerHTML = '';
        addBubble('system', `¡Hola! Soy SuSana 🌿 ${sanaApertura()}`);
        setQuota(0);
      }
    });
  });

  const aviso = document.createElement('p');
  aviso.className = 'small muted chat-disclaimer';
  aviso.textContent = 'No reemplaza a tu médico o nutricionista — ante señales de alarma, busca atención profesional de inmediato.';
  container.appendChild(aviso);

  // "chat-card" (además de "card"): en #app.chat-active (ver navigate()
  // en app.js) es la ÚNICA parte de la pantalla que hace scroll interno
  // -- llena siempre el espacio real hasta justo arriba del input, esté
  // vacía, cargando o llena de mensajes.
  const chatCard = document.createElement('div');
  chatCard.className = 'card chat-card';
  chatCard.innerHTML = '<div class="chat-log" id="chatLog"></div>';
  container.appendChild(chatCard);

  const inputRow = document.createElement('div');
  inputRow.className = 'chat-input-row';
  inputRow.innerHTML = `
    <textarea id="chatInput" rows="1" maxlength="600" placeholder="Escribe tu pregunta…"></textarea>
    <button class="btn accent" id="chatSend" aria-label="Enviar">➤</button>`;
  container.appendChild(inputRow);

  const log = chatCard.querySelector('#chatLog');
  const quotaEl = chatHeader.querySelector('#chatQuota');
  const input = inputRow.querySelector('#chatInput');
  const sendBtn = inputRow.querySelector('#chatSend');

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

  // scroll=false al cargar historial existente: agregar cada mensaje viejo
  // con scrollIntoView("smooth") hacía que la pantalla, apenas se abría el
  // chat, se viera vacía un instante y luego "corriera" mensaje por
  // mensaje hasta el último -- un salto visible que no debería pasar. El
  // historial se pinta completo y de una vez, y loadHistory() salta sin
  // animación al final; solo un mensaje nuevo de verdad (send()) se
  // desplaza con scroll suave.
  function addBubble(role, text, { scroll = true } = {}) {
    const b = document.createElement('div');
    b.className = `chat-msg ${role}`;
    b.textContent = text;
    log.appendChild(b);
    if (scroll) scrollToView(b);
    return b;
  }

  // Sin cuota rígida (decisión explícita: la competencia tampoco limita
  // el número de consultas), y tampoco se muestra un contador -- mostrar
  // "X mensajes este mes" contradecía el mensaje de "casi ilimitado" con
  // el que se vende Premium, dando la sensación de un límite que en
  // realidad no existe. `used` ya no se usa para nada visible, solo queda
  // el parámetro por si algún día vuelve a hacer falta.
  function setQuota() {
    quotaEl.textContent = 'Con el contexto de tu salud 🌿';
  }

  async function loadHistory(idAAbrir) {
    try {
      const data = await fetchGuideHistory(idAAbrir);
      conversationId = data.conversationId;
      log.innerHTML = '';
      let ultimo = null;
      if (!data.history.length) {
        ultimo = addBubble('system', `¡Hola! Soy SuSana 🌿 ${sanaApertura()}`, { scroll: false });
      } else {
        for (const m of data.history) ultimo = addBubble(m.role, m.content, { scroll: false });
      }
      setQuota(data.usedCount);
      // Un solo salto sin animación al final, después de pintar todo el
      // historial de una vez -- no un scroll suave por cada mensaje viejo.
      ultimo?.scrollIntoView({ block: 'end' });
    } catch (e) {
      addBubble('system', 'No pudimos cargar tu historial. Revisa tu conexión.', { scroll: false });
    }
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    addBubble('user', text);
    sendBtn.disabled = true;
    input.disabled = true;

    // El divisor "Nuevo mensaje" se agrega recién cuando la respuesta
    // llega, justo antes de pintarla -- antes aparecía ARRIBA de los
    // puntos de "escribiendo", como si ya hubiera algo nuevo que ver
    // cuando en realidad SuSana seguía pensando.
    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(typing);
    scrollToView(typing);

    try {
      const data = await askGuide(text, conversationId);
      conversationId = data.conversationId;
      typing.remove();
      const divider = addDivider('Nuevo mensaje');
      const reply = addBubble('assistant', data.reply);
      setQuota(data.usedCount);
      // El divisor solo marca "hasta aquí llegó lo nuevo" mientras esta
      // respuesta sigue siendo la más reciente; deja de tener sentido en
      // cuanto la usuaria manda la siguiente pregunta.
      setTimeout(() => divider.remove(), 4000);
      scrollToView(reply);
      sendBtn.disabled = false;
      input.disabled = false;
    } catch (e) {
      typing.remove();
      if (e.code === 'premium_requerido') {
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
        <h2>${GEAR_ICON} Personalizar a ${susanaName()}</h2>
        <p class="small muted mt">Define el tono con el que te habla. Nunca usa culpa ni regaños, solo cambia el estilo.</p>
        <div class="chips mt" id="pz-tonos">
          ${SUSANA_TONOS.map((t) => `<button type="button" class="chip${t.id === tonoActual.id ? ' selected' : ''}" data-tono="${t.id}">${t.emoji} ${t.nombre}</button>`).join('')}
        </div>
        <p class="small mt" style="font-style:italic;border-left:4px solid var(--secondary);padding-left:10px" id="pz-ejemplo">"${esc(tonoActual.ejemplo)}"</p>
        <button type="button" class="setting-row mt" id="pz-memorias" style="padding:10px 0;border-top:1px solid var(--border)">
          <span class="setting-row-icon">🧠</span>
          <span class="setting-row-label">Memorias (${memorias.length}/${MEMORIA_MAX})</span>
          <span class="setting-row-chevron">›</span>
        </button>
        <div class="mt" style="border-top:1px solid var(--border);padding-top:12px">
          <label class="small" style="font-weight:600">Algo de contexto para SuSana</label>
          <p class="small muted" style="margin-top:2px">Ej. "no hago ejercicio hace meses" o "estoy en un momento de mucho estrés". Se suma a tu perfil de siempre, nunca lo reemplaza.</p>
          <textarea id="pz-contexto" class="auth-input" rows="2" maxlength="${CONTEXTO_MAX}" placeholder="Escribe aquí…" style="margin-top:6px">${esc(user.contextoSusana || '')}</textarea>
          <div class="row" style="justify-content:space-between;margin-top:6px">
            <span class="small muted" id="pz-contexto-count"></span>
            <button type="button" class="btn ghost sm" id="pz-contexto-guardar">Guardar</button>
          </div>
        </div>`;

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

      const ctxInput = wrap.querySelector('#pz-contexto');
      const ctxCount = wrap.querySelector('#pz-contexto-count');
      const actualizarContador = () => { ctxCount.textContent = `${ctxInput.value.length}/${CONTEXTO_MAX}`; };
      actualizarContador();
      ctxInput.addEventListener('input', actualizarContador);
      wrap.querySelector('#pz-contexto-guardar').addEventListener('click', () => {
        setState({ user: { ...getState().user, contextoSusana: ctxInput.value.trim() } });
        toast('Guardado 🌿');
      });
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

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "Hoy" / "Ayer" / "31 de agosto" -- mismo criterio de agrupar por fecha
// que el resto de la app (ver etiquetaFecha en diary.js), acá aplicado a
// conversaciones en vez de días con foto.
function etiquetaFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismoDia(fecha, hoy)) return 'Hoy';
  if (mismoDia(fecha, ayer)) return 'Ayer';
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

// Menú hamburguesa del chat: "Historial de SuSana" -- lista de
// conversaciones agrupadas por fecha, con un botón para empezar una
// nueva. Panel de pantalla completa que entra deslizando desde la
// izquierda (referencia real de la usuaria: Fitia Coach), no un diálogo
// centrado -- mismo mecanismo que .cam-fullscreen (variante agregada al
// backdrop DESPUÉS de que openModal lo cuelga del documento, ver
// setTimeout abajo; durante el propio contentBuilder el modal todavía no
// tiene padre). Tocar una fila cierra el panel y carga esa conversación
// en el chat que ya está abierto (no navega a otra pantalla).
function abrirHistorialSuSana(conversationIdActual, { onElegir, onNueva }) {
  openModal((modal, closeFn) => {
    setTimeout(() => modal.parentElement?.classList.add('drawer-izq'), 0);
    modal.insertAdjacentHTML('beforeend', `
      <div class="spread">
        <h2>Historial de ${susanaName()}</h2>
        <button type="button" class="icon-btn plain" id="hist-nueva" aria-label="Nueva conversación">${PENCIL_ICON}</button>
      </div>
      <div class="mt" id="hist-lista"><p class="small muted center">Cargando…</p></div>`);

    modal.querySelector('#hist-nueva').addEventListener('click', async () => {
      closeFn();
      await onNueva();
    });

    listGuideConversations()
      .then((conversations) => {
        const cont = modal.querySelector('#hist-lista');
        if (!conversations.length) {
          cont.innerHTML = '<p class="small muted center">Aún no tienes conversaciones.</p>';
          return;
        }
        cont.innerHTML = '';
        let grupoActual = null;
        for (const c of conversations) {
          const grupo = etiquetaFecha(c.updated_at);
          if (grupo !== grupoActual) {
            grupoActual = grupo;
            const divider = document.createElement('p');
            divider.className = 'small muted mt';
            divider.style.fontWeight = '700';
            divider.textContent = grupo;
            cont.appendChild(divider);
          }
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'habit selector-opcion' + (c.conversation_id === conversationIdActual ? ' selected' : '');
          row.innerHTML = `<label style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.title.slice(0, 60))}</label>`;
          row.addEventListener('click', () => { closeFn(); onElegir(c.conversation_id); });
          cont.appendChild(row);
        }
      })
      .catch(() => {
        modal.querySelector('#hist-lista').innerHTML = '<p class="small muted center">No pudimos cargar tu historial.</p>';
      });
  });
}
