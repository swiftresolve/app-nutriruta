// Pregúntale a tu guía: asistente conversacional Premium.
// Cuota, verificación de plan y la llamada a la IA viven en el servidor
// (Edge Function ai-assistant) — aquí solo se pinta el chat y se envía.
import { isPremium, getState, setState, sanaApertura, esc, agregarMemoria, eliminarMemoria, MEMORIA_MAX } from '../store.js';
import { fetchGuideHistory, askGuide, analyzeFood, listGuideConversations, deleteGuideConversation } from '../supabase-client.js';
import { header, navigate, toast, susanaName, openModal, GEAR_ICON, PENCIL_ICON, THUMBS_UP_ICON, THUMBS_DOWN_ICON, THUMBS_UP_SOLID_ICON, THUMBS_DOWN_SOLID_ICON, ARROW_UP_ICON } from '../app.js';
import { SUSANA_TONOS } from '../data/susanaTonos.js';
import { t } from '../i18n.js';

// Ícono de menú hamburguesa -- 3 líneas simples, mismo lenguaje visual
// que el resto de íconos propios de la app (GEAR_ICON, SEARCH_ICON en
// app.js): trazo sin relleno, no emoji.
const MENU_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;

const CONTEXTO_MAX = 300;
// Caché local SOLO de la lista de conversaciones del historial (drawer) --
// sin esto, cada vez que se abría el historial se veía "Cargando…" un
// instante aunque fuera exactamente la misma lista de la última vez. Se
// pinta la versión guardada de inmediato y de fondo se pide la real, que
// reemplaza la lista si algo cambió (ver abrirHistorialSuSana).
// NO existe una caché equivalente para "reanudar" el último chat al abrir
// SuSana -- se quitó a propósito: abrir SuSana debe empezar SIEMPRE una
// conversación nueva, nunca la última guardada (pedido explícito).
const HIST_CACHE_KEY = 'nutriruta-susana-hist-cache';
function leerHistCache() {
  try { return JSON.parse(localStorage.getItem(HIST_CACHE_KEY) || 'null'); } catch { return null; }
}
function guardarHistCache(conversations) {
  try { localStorage.setItem(HIST_CACHE_KEY, JSON.stringify(conversations)); } catch { /* localStorage lleno o bloqueado, no es crítico */ }
}

export function renderAssistant(container, params = {}) {
  if (!isPremium()) {
    header(container);
    const lock = document.createElement('div');
    lock.className = 'card center';
    lock.innerHTML = `
      <div style="font-size:2.6rem">💬</div>
      <h2>${t('{nombre}, tu guía', { nombre: susanaName() })}</h2>
      <p class="mt">${t('Un espacio para resolver dudas puntuales de nutrición y hábitos, con el contexto de tu perfil — como tener acompañamiento a la mano. Es parte del {strong}plan Premium{fin}.', { strong: '<strong>', fin: '</strong>' })}</p>
      <button class="btn accent full mt">${t('Ver planes Premium')}</button>`;
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
    <button type="button" class="icon-btn plain" id="chatHistorial" aria-label="${t('Historial de conversaciones')}">${MENU_ICON}</button>
    <span class="sana-avatar chat-header-avatar">🌿</span>
    <div class="chat-header-info">
      <strong>${susanaName()}</strong>
      <span class="small muted" id="chatQuota">${t('Cargando…')}</span>
    </div>
    <button type="button" class="icon-btn plain" id="chatPersonalizar" aria-label="${t('Personalizar a SuSana')}">${GEAR_ICON}</button>`;
  container.appendChild(chatHeader);
  chatHeader.querySelector('#chatPersonalizar').addEventListener('click', () => abrirPersonalizarSuSana());
  chatHeader.querySelector('#chatHistorial').addEventListener('click', () => {
    abrirHistorialSuSana(conversationId, {
      onElegir: (id) => loadHistory(id),
      // Sin llamar al servidor por un id todavía -- si nunca se manda un
      // mensaje, esta conversación no debe existir en el historial real
      // (askGuide ya genera su propio id cuando conversationId es null,
      // ver ai-assistant/index.ts).
      onNueva: () => {
        conversationId = null;
        log.innerHTML = '';
        addBubble('system', t('¡Hola! Soy SuSana 🌿 {apertura}', { apertura: sanaApertura() }));
        ultimaFirma = null;
      }
    });
  });

  const aviso = document.createElement('p');
  aviso.className = 'small muted chat-disclaimer';
  aviso.textContent = t('No reemplaza a tu médico o nutricionista — ante señales de alarma, busca atención profesional de inmediato.');
  container.appendChild(aviso);

  // "chat-card" (además de "card"): en #app.chat-active (ver navigate()
  // en app.js) es la ÚNICA parte de la pantalla que hace scroll interno
  // -- llena siempre el espacio real hasta justo arriba del input, esté
  // vacía, cargando o llena de mensajes.
  const chatCard = document.createElement('div');
  chatCard.className = 'chat-card';
  chatCard.innerHTML = '<div class="chat-log" id="chatLog"></div>';
  container.appendChild(chatCard);

  const inputRow = document.createElement('div');
  inputRow.className = 'chat-input-row';
  inputRow.innerHTML = `
    <textarea id="chatInput" rows="1" maxlength="600" placeholder="${t('Habla con SuSana...')}"></textarea>
    <button class="btn accent" id="chatSend" aria-label="${t('Enviar')}">${ARROW_UP_ICON}</button>`;
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
  // Pulgar arriba/abajo bajo cada respuesta de SuSana (referencia real:
  // Fitia Coach) -- solo feedback local por ahora (resalta el elegido +
  // agradece), sin guardarlo en el servidor todavía.
  function agregarFeedback(bubble) {
    const fila = document.createElement('div');
    fila.className = 'chat-feedback';
    fila.innerHTML = `
      <button type="button" class="chat-feedback-btn" data-val="up" aria-label="${t('Buena respuesta')}">${THUMBS_UP_ICON}</button>
      <button type="button" class="chat-feedback-btn" data-val="down" aria-label="${t('Mala respuesta')}">${THUMBS_DOWN_ICON}</button>`;
    const ICONOS = { up: [THUMBS_UP_ICON, THUMBS_UP_SOLID_ICON], down: [THUMBS_DOWN_ICON, THUMBS_DOWN_SOLID_ICON] };
    fila.querySelectorAll('.chat-feedback-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        fila.querySelectorAll('.chat-feedback-btn').forEach((b2) => {
          b2.classList.remove('elegido');
          b2.innerHTML = ICONOS[b2.dataset.val][0];
        });
        btn.classList.add('elegido');
        // El pulgar elegido se rellena de verdad (ícono sólido, no solo
        // un cambio de color sobre el mismo trazo) -- referencia real de
        // Fitia Coach.
        btn.innerHTML = ICONOS[btn.dataset.val][1];
        toast(t('Gracias por tu opinión'));
      });
    });
    bubble.appendChild(fila);
  }

  function addBubble(role, text, { scroll = true } = {}) {
    const b = document.createElement('div');
    b.className = `chat-msg ${role}`;
    const textEl = document.createElement('div');
    textEl.textContent = text;
    b.appendChild(textEl);
    if (role === 'assistant') agregarFeedback(b);
    log.appendChild(b);
    if (scroll) scrollToView(b);
    return b;
  }

  // Tarjeta de análisis de una comida (referencia real: "Fitia Coach"):
  // 2 bloques con una barra de 3 niveles + etiqueta ("Óptimo"/"Excelente"/
  // etc.) + texto, en vez de la burbuja de texto plano normal. Todo el
  // contenido dinámico pasa por esc() antes de entrar al innerHTML.
  const NIVEL_COLOR = { alto: 'verde', medio: 'amarillo', bajo: 'rojo' };
  const NIVEL_POS = { alto: 2, medio: 1, bajo: 0 };
  function bloqueAnalisis(icono, pregunta, bloque) {
    const color = NIVEL_COLOR[bloque.nivel] || 'amarillo';
    const pos = NIVEL_POS[bloque.nivel] ?? 1;
    const segmentos = [0, 1, 2].map((i) => `<span class="ca-seg${i === pos ? ` activo ${color}` : ''}"></span>`).join('');
    const justify = pos === 0 ? 'flex-start' : pos === 1 ? 'center' : 'flex-end';
    return `<div class="ca-block">
      <div class="ca-titulo">${icono} ${esc(pregunta)}</div>
      <div class="ca-badge-row" style="justify-content:${justify}"><span class="ca-badge ${color}">${esc(bloque.rating)}</span></div>
      <div class="ca-bar">${segmentos}</div>
      <p class="ca-texto">${esc(bloque.texto)}</p>
    </div>`;
  }
  function renderAnalysisCard(recetaNombre, data) {
    return `<p>${t('¡Hola! Aquí tienes el análisis de "{receta}". 🌿', { receta: esc(recetaNombre) })}</p>
      <div class="chat-analysis-card">
        ${bloqueAnalisis('❤️', t('¿Qué tan nutritiva es?'), data.nutritivo)}
        ${bloqueAnalisis('🎯', t('¿Cómo se integra en tu día?'), data.integracion)}
      </div>
      ${data.cierre ? `<p class="mt">${esc(data.cierre)}</p>` : ''}`;
  }
  function addCardBubble(role, html, { scroll = true } = {}) {
    const b = document.createElement('div');
    b.className = `chat-msg ${role} chat-msg-card`;
    b.innerHTML = html;
    if (role === 'assistant') agregarFeedback(b);
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
    quotaEl.textContent = t('Con el contexto de tu salud 🌿');
  }

  // Pinta un historial ya resuelto (del servidor) en el chat -- usado al
  // elegir una conversación vieja desde "Historial". No toca el log si el
  // contenido es exactamente el mismo que ya se ve, para evitar un
  // re-render/salto de scroll innecesario si se llama dos veces seguidas.
  let ultimaFirma = null;
  function pintarHistorial(idConv, history, usedCount) {
    const firma = `${idConv}:${history.length}:${history[history.length - 1]?.content ?? ''}`;
    if (firma === ultimaFirma) { setQuota(usedCount); return; }
    ultimaFirma = firma;
    conversationId = idConv;
    log.innerHTML = '';
    let ultimo = null;
    if (!history.length) {
      ultimo = addBubble('system', t('¡Hola! Soy SuSana 🌿 {apertura}', { apertura: sanaApertura() }), { scroll: false });
    } else {
      for (const m of history) ultimo = addBubble(m.role, m.content, { scroll: false });
    }
    setQuota(usedCount);
    ultimo?.scrollIntoView({ block: 'end' });
  }

  async function loadHistory(idAAbrir) {
    try {
      const data = await fetchGuideHistory(idAAbrir);
      pintarHistorial(data.conversationId, data.history, data.usedCount);
    } catch (e) {
      addBubble('system', t('No pudimos cargar tu historial. Revisa tu conexión.'), { scroll: false });
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
      const divider = addDivider(t('Nuevo mensaje'));
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
        toast(t('Tu plan Premium ya no está activo.'));
        navigate('plans');
      } else {
        addBubble('system', e.message || t('No se pudo enviar tu pregunta. Intenta de nuevo.'));
        sendBtn.disabled = false;
        input.disabled = false;
      }
    }
  }

  // "Analizar con SuSana" para una receta fuera de catálogo (dashboard.js/
  // planner.js) -- acción de servidor aparte (analyzeFood, no askGuide):
  // el system prompt de chat normal bloquea a propósito que un mensaje de
  // la usuaria pida JSON crudo (blindaje contra fuga de datos), así que
  // esto no puede disfrazarse de mensaje de chat -- necesita su propia
  // ruta de confianza con su propio system prompt (ver
  // ANALYSIS_SYSTEM_PROMPT en ai-assistant/index.ts).
  async function enviarAnalisis(recetaNombre, descripcion) {
    sendBtn.disabled = true;
    input.disabled = true;
    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(typing);
    scrollToView(typing);
    try {
      const data = await analyzeFood(descripcion, conversationId);
      conversationId = data.conversationId;
      typing.remove();
      const bubble = addCardBubble('assistant', renderAnalysisCard(recetaNombre, data.analysis));
      setQuota();
      scrollToView(bubble);
      sendBtn.disabled = false;
      input.disabled = false;
    } catch (e) {
      typing.remove();
      if (e.code === 'premium_requerido') {
        toast(t('Tu plan Premium ya no está activo.'));
        navigate('plans');
      } else {
        addBubble('system', e.message || t('No se pudo analizar. Intenta de nuevo.'));
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

  // "Analizar con SuSana" (botón en la modal de receta, ver dashboard.js)
  // -- SIEMPRE abre una conversación nueva (pedido explícito: no debe
  // continuar el chat anterior, cada análisis empieza de cero) y muestra
  // el resultado como tarjeta visual (barras + etiquetas, referencia
  // real: Fitia Coach), no como mensaje de texto suelto:
  // - params.instantCard: receta del CATÁLOGO -- el semáforo ya ES el
  //   análisis (curado a mano), se pinta directo sin gastar IA. No queda
  //   en el historial real porque nunca se manda un mensaje de verdad al
  //   servidor (nada que guardar, ver comentario en el branch de abajo).
  // - params.descripcionAnalisis: receta fuera de catálogo -- análisis
  //   real con IA vía analyzeFood() (acción 'analyze' del servidor, con
  //   su propio system prompt -- ver ANALYSIS_SYSTEM_PROMPT en
  //   ai-assistant/index.ts). conversationId arranca en null a propósito:
  //   el servidor genera su propio id y guarda el intercambio ahí mismo,
  //   un solo viaje de red, y esta conversación ya queda en el historial
  //   real desde el primer mensaje.
  if (params.nuevaConversacion) {
    conversationId = null;
    ultimaFirma = null;
    log.innerHTML = '';
    setQuota();
    if (params.instantCard) {
      addCardBubble('assistant', renderAnalysisCard(params.instantCard.recetaNombre, params.instantCard));
    } else if (params.descripcionAnalisis) {
      enviarAnalisis(params.recetaNombre, params.descripcionAnalisis);
    }
  } else {
    // Abrir SuSana desde el menú SIEMPRE empieza una conversación nueva --
    // pedido explícito, antes reanudaba la última guardada. La anterior
    // sigue disponible en "Historial", solo que ya no se abre sola. Sin
    // esperar red para pintar el saludo -- conversationId se queda en
    // null hasta que de verdad se manda un mensaje (askGuide genera su
    // propio id cuando llega null, ver ai-assistant/index.ts), así que
    // esta conversación nunca aparece en el historial real si nunca se
    // le escribe nada.
    addBubble('system', t('¡Hola! Soy SuSana 🌿 {apertura}', { apertura: sanaApertura() }), { scroll: false });
    setQuota();
    if (params.prefill) {
      input.value = params.prefill;
      send();
    }
  }
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
      const tonoActual = SUSANA_TONOS.find((tono) => tono.id === (user.tonoSusana || 'calida')) || SUSANA_TONOS[0];
      const memorias = user.memorias || [];
      wrap.innerHTML = `
        <h2>${GEAR_ICON} ${t('Personalizar a {nombre}', { nombre: susanaName() })}</h2>
        <p class="small muted mt">${t('Define el tono con el que te habla. Nunca usa culpa ni regaños, solo cambia el estilo.')}</p>
        <div class="chips mt" id="pz-tonos">
          ${SUSANA_TONOS.map((tono) => `<button type="button" class="chip${tono.id === tonoActual.id ? ' selected' : ''}" data-tono="${tono.id}">${tono.emoji} ${tono.nombre}</button>`).join('')}
        </div>
        <p class="small mt" style="font-style:italic;border-left:4px solid var(--secondary);padding-left:10px" id="pz-ejemplo">"${esc(tonoActual.ejemplo)}"</p>
        <button type="button" class="setting-row mt" id="pz-memorias" style="padding:10px 0;border-top:1px solid var(--border)">
          <span class="setting-row-icon">🧠</span>
          <span class="setting-row-label">${t('Memorias ({n}/{max})', { n: memorias.length, max: MEMORIA_MAX })}</span>
          <span class="setting-row-chevron">›</span>
        </button>
        <div class="mt" style="border-top:1px solid var(--border);padding-top:12px">
          <label class="small" style="font-weight:600">${t('Algo de contexto para {nombre}', { nombre: susanaName() })}</label>
          <p class="small muted" style="margin-top:2px">${t('Ej. "no hago ejercicio hace meses" o "estoy en un momento de mucho estrés". Se suma a tu perfil de siempre, nunca lo reemplaza.')}</p>
          <textarea id="pz-contexto" class="auth-input" rows="2" maxlength="${CONTEXTO_MAX}" placeholder="${t('Escribe aquí…')}" style="margin-top:6px">${esc(user.contextoSusana || '')}</textarea>
          <div class="row" style="justify-content:space-between;margin-top:6px">
            <span class="small muted" id="pz-contexto-count"></span>
            <button type="button" class="btn ghost sm" id="pz-contexto-guardar">${t('Guardar')}</button>
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
        toast(t('Guardado 🌿'));
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
        <h2>🧠 ${t('Memorias')}</h2>
        <p class="small muted mt">${t('{n}/{max} creadas. {nombre} las tiene en cuenta en cada respuesta.', { n: memorias.length, max: MEMORIA_MAX, nombre: susanaName() })}</p>
        <div class="mt" id="mem-lista"></div>
        <textarea id="mem-nueva" class="auth-input mt" rows="2" maxlength="200" placeholder="${t('Ej: hace meses no hago ejercicio, quiero retomar con disciplina')}" ${lleno ? 'disabled' : ''}></textarea>
        <button class="btn ghost full mt" id="mem-agregar" ${lleno ? 'disabled' : ''}>${lleno ? t('Llegaste al máximo de 10') : t('+ Agregar')}</button>`;
      const lista = wrap.querySelector('#mem-lista');
      if (!memorias.length) {
        lista.innerHTML = `<p class="small muted">${t('Aún no has guardado ninguna.')}</p>`;
      } else {
        for (const m of memorias) {
          const row = document.createElement('div');
          row.className = 'habit';
          row.innerHTML = `<label style="flex:1">${esc(m.texto)}</label><button type="button" class="link-btn small" aria-label="${t('Eliminar')}">🗑️</button>`;
          row.querySelector('button').addEventListener('click', () => { eliminarMemoria(m.id); pintar(); });
          lista.appendChild(row);
        }
      }
      wrap.querySelector('#mem-agregar').addEventListener('click', () => {
        const val = wrap.querySelector('#mem-nueva').value;
        if (!agregarMemoria(val)) { toast(t('Escribe algo, o ya llegaste al máximo de 10.')); return; }
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
  if (mismoDia(fecha, hoy)) return t('Hoy');
  if (mismoDia(fecha, ayer)) return t('Ayer');
  return t('{d} de {mes}', { d: fecha.getDate(), mes: t(MESES[fecha.getMonth()]) });
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
// Confirmación antes de borrar -- irreversible (no hay papelera), mismo
// criterio que confirmarEliminarReceta en planner.js: nunca un solo toque.
function confirmarEliminarConversacion(c, onConfirmado) {
  openModal((modalConfirmar, closeConfirmar) => {
    modalConfirmar.insertAdjacentHTML('beforeend', `
      <h2>${t('¿Eliminar "{nombre}"?', { nombre: esc(c.title.slice(0, 60)) })}</h2>
      <p class="mt">${t('Esta acción no se puede deshacer.')}</p>`);
    const yes = document.createElement('button');
    yes.className = 'btn danger full mt';
    yes.textContent = t('Sí, eliminar');
    yes.addEventListener('click', async () => {
      yes.disabled = true;
      try {
        await deleteGuideConversation(c.conversation_id);
        closeConfirmar();
        onConfirmado();
      } catch (e) {
        toast(e.message || t('No se pudo eliminar la conversación.'));
        yes.disabled = false;
      }
    });
    modalConfirmar.appendChild(yes);
  });
}

function abrirHistorialSuSana(conversationIdActual, { onElegir, onNueva }) {
  openModal((modal, closeFn) => {
    setTimeout(() => modal.parentElement?.classList.add('drawer-izq'), 0);
    // Sin texto de "Cargando…" -- si hay una lista en caché se pinta de
    // inmediato (ver abajo); si no, queda vacío hasta que llegue la real
    // en vez de mostrar un mensaje que solo dura una fracción de segundo.
    modal.insertAdjacentHTML('beforeend', `
      <div class="spread">
        <h2>${t('Historial de {nombre}', { nombre: susanaName() })}</h2>
        <button type="button" class="icon-btn plain" id="hist-nueva" aria-label="${t('Nueva conversación')}">${PENCIL_ICON}</button>
      </div>
      <div class="mt" id="hist-lista"></div>`);

    modal.querySelector('#hist-nueva').addEventListener('click', () => {
      closeFn();
      onNueva();
    });

    const cont = modal.querySelector('#hist-lista');
    // Deslizar una fila hacia la izquierda revela "Eliminar" debajo (misma
    // referencia visual que mostró la usuaria) -- ANCHO_BOTON es lo que se
    // asoma. Solo una fila puede estar abierta a la vez: abrir otra cierra
    // la anterior, mismo comportamiento esperado en cualquier lista así.
    const ANCHO_BOTON = 76;
    let filaAbierta = null;
    function crearFilaHistorial(c) {
      const wrap = document.createElement('div');
      wrap.className = 'hist-row-wrap';
      wrap.innerHTML = `
        <button type="button" class="hist-row-delete" aria-label="${t('Eliminar conversación')}">🗑️</button>
        <button type="button" class="hist-row${c.conversation_id === conversationIdActual ? ' selected' : ''}">${esc(c.title.slice(0, 60))}</button>`;
      const row = wrap.querySelector('.hist-row');
      let inicioX = 0, inicioY = 0, offsetActual = 0, arrastrando = false, esHorizontal = null;
      const cerrar = () => {
        offsetActual = 0;
        row.style.transition = 'transform 0.2s ease';
        row.style.transform = 'translateX(0)';
        if (filaAbierta === wrap) filaAbierta = null;
      };
      row.addEventListener('touchstart', (e) => {
        if (filaAbierta && filaAbierta !== wrap) cerrarFilaAbierta();
        inicioX = e.touches[0].clientX; inicioY = e.touches[0].clientY;
        arrastrando = true; esHorizontal = null;
        row.style.transition = 'none';
      });
      row.addEventListener('touchmove', (e) => {
        if (!arrastrando) return;
        const dx = e.touches[0].clientX - inicioX;
        const dy = e.touches[0].clientY - inicioY;
        if (esHorizontal === null) esHorizontal = Math.abs(dx) > Math.abs(dy);
        if (!esHorizontal) return;
        e.preventDefault();
        const base = filaAbierta === wrap ? -ANCHO_BOTON : 0;
        offsetActual = Math.max(-ANCHO_BOTON, Math.min(0, base + dx));
        row.style.transform = `translateX(${offsetActual}px)`;
      }, { passive: false });
      row.addEventListener('touchend', () => {
        arrastrando = false;
        if (!esHorizontal) return;
        row.style.transition = 'transform 0.2s ease';
        const abierta = offsetActual < -ANCHO_BOTON / 2;
        offsetActual = abierta ? -ANCHO_BOTON : 0;
        row.style.transform = `translateX(${offsetActual}px)`;
        filaAbierta = abierta ? wrap : (filaAbierta === wrap ? null : filaAbierta);
      });
      row.addEventListener('click', (e) => {
        if (filaAbierta === wrap) { e.preventDefault(); cerrar(); return; }
        closeFn(); onElegir(c.conversation_id);
      });
      wrap.querySelector('.hist-row-delete').addEventListener('click', () => {
        confirmarEliminarConversacion(c, () => {
          const eraActual = c.conversation_id === conversationIdActual;
          wrap.remove();
          const cacheada2 = leerHistCache();
          if (cacheada2) guardarHistCache(cacheada2.filter((x) => x.conversation_id !== c.conversation_id));
          if (eraActual) { closeFn(); onNueva(); }
        });
      });
      wrap.cerrarFilaAbierta = cerrar;
      return wrap;
    }
    function cerrarFilaAbierta() { filaAbierta?.cerrarFilaAbierta?.(); }

    function pintarLista(conversations) {
      if (!conversations.length) {
        cont.innerHTML = `<p class="small muted center">${t('Aún no tienes conversaciones.')}</p>`;
        return;
      }
      cont.innerHTML = '';
      filaAbierta = null;
      let grupoActual = null;
      for (const c of conversations) {
        const grupo = etiquetaFecha(c.updated_at);
        if (grupo !== grupoActual) {
          if (grupoActual !== null) cont.appendChild(document.createElement('hr')).className = 'hist-day-divider';
          grupoActual = grupo;
          const divider = document.createElement('p');
          divider.className = 'small muted mt';
          divider.style.fontWeight = '700';
          divider.textContent = grupo;
          cont.appendChild(divider);
        }
        cont.appendChild(crearFilaHistorial(c));
      }
    }

    const cacheada = leerHistCache();
    if (cacheada) pintarLista(cacheada);

    listGuideConversations()
      .then((conversations) => {
        guardarHistCache(conversations);
        pintarLista(conversations);
      })
      .catch(() => {
        // Si ya había algo en caché pintado, se deja tal cual en vez de
        // taparlo con un error por un fallo puntual de red.
        if (!cacheada) cont.innerHTML = `<p class="small muted center">${t('No pudimos cargar tu historial.')}</p>`;
      });
  });
}
