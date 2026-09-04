// Ajustes: cuenta, perfiles, exclusiones, quiz, datos y sección legal.
// Estructura: un menú (hub) con una fila por sección -- tocar una fila
// navega a su propia página con su contenido adentro (navigate('settings',
// { seccion })), en vez de mostrar todas las tarjetas apiladas de una vez.
import { getState, setState, resetState, getPlan, isPremium, planExpired, planExpiry, esc, logPeso, ultimoPeso, getWaterGoal, calcularIMC, DEFAULT_HORA_COMIDAS, getTema, setTema } from '../store.js';
import { PROFILES, EXCLUSIONS } from '../data/profiles.js';
import { MEALS } from '../data/recipes.js';
import { getSession, signOut, pushProfileState, fetchMyResena, submitResena, uploadAvatar, avatarUrlFor, checkIsAdmin, miCodigoReferido, validarCodigoReferido } from '../supabase-client.js';
import { navigate, header, openModal, toast, abrirComprarNutricoins, GEAR_ICON } from '../app.js';
import { iniciarTour } from './tour.js';
import { pushSupported, currentSubscription, enablePush, disablePush } from '../push.js';

// Fila de ajuste (ícono + etiqueta + valor + flecha), estilo lista de
// configuración compacta -- abre un selector chico al tocarla en vez de
// mostrar todas las opciones expandidas como chips. Reutilizable para
// cualquier preferencia de valor único (tema, idioma, unidades...) y para
// las filas del menú principal de Ajustes (sin valor, solo navegan).
function filaAjuste(icono, etiqueta, valorTexto, onTap) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'setting-row';
  row.innerHTML = `
    <span class="setting-row-icon">${icono}</span>
    <span class="setting-row-label">${esc(etiqueta)}</span>
    <span class="setting-row-value">${esc(valorTexto)}</span>
    <span class="setting-row-chevron">›</span>`;
  row.addEventListener('click', onTap);
  return row;
}

// Selector de una sola opción dentro del modal ya existente en la app
// (no una hoja nueva) -- la opción elegida se resalta con un check.
function abrirSelector(titulo, opciones, valorActual, onElegir) {
  openModal((modal, closeFn) => {
    modal.insertAdjacentHTML('beforeend', `<h2>${esc(titulo)}</h2><div class="mt" id="selector-opciones"></div>`);
    const cont = modal.querySelector('#selector-opciones');
    for (const op of opciones) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'habit selector-opcion' + (op.id === valorActual ? ' selected' : '');
      row.innerHTML = `<label>${esc(op.label)}</label>${op.id === valorActual ? '<span>✓</span>' : ''}`;
      row.addEventListener('click', () => { onElegir(op.id); closeFn(); });
      cont.appendChild(row);
    }
  });
}

// ---------- Menú principal (hub) ----------
// Función, no arreglo fijo a nivel de módulo -- construirlo al cargar el
// archivo intentaba leer GEAR_ICON antes de que app.js terminara de
// inicializarlo (import circular real: app.js importa renderSettings de
// aquí, y aquí se importa GEAR_ICON de app.js). Llamarla recién al
// pintar el hub evita el "Cannot access before initialization".
function settingsSecciones() {
  return [
    { id: 'cuenta', icon: '👤', label: 'Mi cuenta' },
    { id: 'sobre-ti', icon: '⚖️', label: 'Sobre ti' },
    { id: 'salud', icon: '🩺', label: 'Salud y alimentación' },
    { id: 'comidas', icon: '⏰', label: 'Horario de comidas' },
    { id: 'interfaz', icon: '🌎', label: 'Interfaz y preferencias' },
    { id: 'notificaciones', icon: '🔔', label: 'Notificaciones', condicion: () => pushSupported() },
    { id: 'referidos', icon: '🎁', label: 'Referidos y NutriCoins' },
    { id: 'resena', icon: '🌿', label: 'Califica tu experiencia' },
    { id: 'datos', icon: GEAR_ICON, label: 'Cuenta y datos' },
    { id: 'legal', icon: '⚖️', label: 'Legal' }
  ];
}

const SECCION_BUILDERS = {
  'cuenta': pintarCuenta,
  'sobre-ti': pintarSobreTi,
  'salud': pintarSalud,
  'comidas': pintarComidas,
  'interfaz': pintarInterfaz,
  'notificaciones': pintarNotificaciones,
  'referidos': pintarReferidos,
  'resena': pintarResena,
  'datos': pintarDatos,
  'legal': pintarLegal
};

export function renderSettings(container, params = {}) {
  header(container);

  const seccion = params.seccion;
  if (seccion) {
    const builder = SECCION_BUILDERS[seccion];
    if (!builder) { navigate('settings'); return; }
    const back = document.createElement('button');
    back.className = 'link-btn small';
    back.textContent = '← Ajustes';
    back.addEventListener('click', () => navigate('settings'));
    container.appendChild(back);
    builder(container);
    return;
  }

  // Resumen de cuenta: dos tarjetas lado a lado (foto a la izquierda,
  // nombre + plan a la derecha) arriba del menú -- un vistazo rápido de
  // quién eres sin tener que entrar a "Mi cuenta". Tocar cualquiera de
  // las dos abre esa sección, igual que las filas de abajo.
  const { user } = getState();
  const inicialResumen = esc((user.nombre || 'N').trim().charAt(0).toUpperCase() || 'N');
  const resumen = document.createElement('div');
  resumen.className = 'row';
  resumen.style.cssText = 'gap:10px;align-items:stretch';
  resumen.innerHTML = `
    <div class="card center" id="resumen-foto" style="flex:1;min-width:0;cursor:pointer;padding:14px">
      <span class="avatar-upload" style="pointer-events:none">
        <img id="resumen-avatar-img" alt="" hidden>
        <span id="resumen-avatar-fallback">${inicialResumen}</span>
      </span>
    </div>
    <div class="card center" id="resumen-info" style="flex:1;min-width:0;cursor:pointer;padding:14px;display:flex;flex-direction:column;justify-content:center;align-items:center">
      <strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">${esc(user.nombre || 'Sin nombre')}</strong>
      <span class="small muted mt" id="resumen-plan">Cargando…</span>
      <span class="small muted" id="resumen-cobro"></span>
    </div>`;
  const irACuenta = () => navigate('settings', { seccion: 'cuenta' });
  resumen.querySelector('#resumen-foto').addEventListener('click', irACuenta);
  resumen.querySelector('#resumen-info').addEventListener('click', irACuenta);
  const resumenPlan = resumen.querySelector('#resumen-plan');
  const resumenCobro = resumen.querySelector('#resumen-cobro');
  resumenPlan.textContent = planExpired() ? 'Premium vencido' : isPremium() ? `✨ Premium ${getPlan().periodo}` : 'Plan gratuito';
  // Próximo cobro: solo tiene sentido con un plan Premium vigente -- el
  // plan gratuito y un Premium ya vencido no tienen fecha de cobro real.
  if (isPremium() && !planExpired()) {
    const vence = planExpiry();
    resumenCobro.textContent = vence ? `Próximo cobro: ${vence.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
  }
  getSession().then((s) => {
    if (!s) return;
    const img = resumen.querySelector('#resumen-avatar-img');
    const fallback = resumen.querySelector('#resumen-avatar-fallback');
    img.src = avatarUrlFor(s.user.id);
    img.onload = () => { img.hidden = false; fallback.hidden = true; };
  });
  container.appendChild(resumen);

  const menu = document.createElement('div');
  menu.className = 'card mt';
  for (const s of settingsSecciones()) {
    if (s.condicion && !s.condicion()) continue;
    menu.appendChild(filaAjuste(s.icon, s.label, '', () => navigate('settings', { seccion: s.id })));
  }
  container.appendChild(menu);

  const ver = document.createElement('p');
  ver.className = 'muted small center mt';
  ver.textContent = 'NutriRuta v2.1 · Hecha con 💚 para tu bienestar';
  container.appendChild(ver);
}

// ---------- Mi cuenta ----------
function pintarCuenta(container) {
  const { user } = getState();
  const account = document.createElement('div');
  account.className = 'card';
  const plan = getPlan();
  const vence = planExpiry();
  const planHtml = planExpired()
    ? '<span class="tag rojo">Premium vencido</span> <span class="muted small">renueva en Planes</span>'
    : isPremium()
      ? `<span class="tag verde">✨ Premium ${plan.periodo}</span> <span class="muted small">activo hasta el ${vence.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</span>`
      : '<span class="tag info">Plan gratuito</span>';
  const inicial = esc((user.nombre || 'N').trim().charAt(0).toUpperCase() || 'N');
  account.innerHTML = `
    <div class="center">
      <label class="avatar-upload" for="avatar-input" aria-label="Cambiar foto de perfil">
        <img id="avatar-img" alt="" hidden>
        <span id="avatar-fallback">${inicial}</span>
        <span class="avatar-cam">📷</span>
      </label>
      <input type="file" id="avatar-input" accept="image/*" hidden>
      <p class="small muted" id="avatar-estado" style="min-height:1em"></p>
    </div>
    <h2>👤 Mi cuenta</h2>
    <p class="small" id="acc-email">Cargando…</p>
    <p class="mt">${planHtml}</p>`;
  const avatarImg = account.querySelector('#avatar-img');
  const avatarFallback = account.querySelector('#avatar-fallback');
  const avatarEstado = account.querySelector('#avatar-estado');
  getSession().then((s) => {
    const el = account.querySelector('#acc-email');
    if (el) el.innerHTML = s ? `Sesión iniciada como <strong>${esc(s.user.email)}</strong> 🔐` : 'Sin sesión activa.';
    if (!s) return;
    avatarImg.src = avatarUrlFor(s.user.id);
    avatarImg.onload = () => { avatarImg.hidden = false; avatarFallback.hidden = true; };
    avatarImg.onerror = () => { avatarImg.hidden = true; avatarFallback.hidden = false; };
  });
  account.querySelector('#avatar-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Elige un archivo de imagen.'); return; }
    avatarEstado.textContent = 'Subiendo…';
    try {
      const url = await uploadAvatar(file);
      avatarImg.src = url;
      avatarImg.onload = () => { avatarImg.hidden = false; avatarFallback.hidden = true; };
      avatarEstado.textContent = '¡Foto actualizada! 🌿';
      setTimeout(() => { if (avatarEstado.textContent === '¡Foto actualizada! 🌿') avatarEstado.textContent = ''; }, 2500);
    } catch (err) {
      // Antes se mostraba un mensaje genérico que escondía el error real
      // (ej. RLS, CORS, tipo de archivo, sesión vencida) y hacía imposible
      // diagnosticar el bug reportado ("sigue sin funcionar"). Mostrar el
      // detalle real hasta encontrar la causa de fondo.
      const detalle = err.message || err.error_description || err.error || JSON.stringify(err);
      console.error('Error subiendo avatar:', err);
      avatarEstado.textContent = `No se pudo subir la foto: ${detalle}`;
    }
  });
  const plansBtn = document.createElement('button');
  plansBtn.className = 'btn ghost full mt mb';
  plansBtn.textContent = '✨ Ver planes (mensual / anual)';
  plansBtn.addEventListener('click', () => navigate('plans'));
  account.appendChild(plansBtn);
  const outBtn = document.createElement('button');
  outBtn.className = 'btn ghost full';
  outBtn.textContent = '🚪 Cerrar sesión';
  outBtn.addEventListener('click', async () => {
    await signOut();
    toast('Sesión cerrada. ¡Vuelve pronto! 🌿');
  });
  account.appendChild(outBtn);
  // El servidor sigue siendo quien de verdad decide (admin_dashboard
  // rechaza a cualquiera fuera de admin_emails al pedir los datos) -- pero
  // mostrarle el botón a TODAS las usuarias no tenía sentido: confundía,
  // invitaba a curiosear una pantalla que de todos modos les va a negar el
  // acceso. checkIsAdmin() es solo para decidir si se muestra o no.
  checkIsAdmin().then((esAdmin) => {
    if (!esAdmin) return;
    const adminLink = document.createElement('button');
    adminLink.className = 'link-btn small center';
    adminLink.style.display = 'block';
    adminLink.style.width = '100%';
    adminLink.style.marginTop = '10px';
    adminLink.textContent = 'Panel de administración';
    adminLink.addEventListener('click', () => navigate('admin'));
    account.appendChild(adminLink);
  });
  container.appendChild(account);
}

// ---------- Referidos y NutriCoins ----------
function pintarReferidos(container) {
  // Referidos: compartir el código propio. El bono (30 días de Premium)
  // solo se otorga a quien COMPARTE el código -- no a quien lo usa -- si
  // la persona referida activa el plan ANUAL y no lo cancela/reembolsa en
  // los primeros 7 días. Ver hotmart-webhook (registra el referido
  // "pendiente") y el cron referral-check (lo confirma y otorga pasados
  // los 7 días, solo al referente).
  const referidos = document.createElement('div');
  referidos.className = 'card';
  referidos.innerHTML = `
    <h2>🎁 Invita y gana Premium</h2>
    <p class="small mb">Comparte tu código. Cuando alguien lo usa y activa el <strong>plan anual</strong> sin cancelarlo en los primeros 7 días, tú ganas <strong>30 días de Premium</strong> gratis.</p>
    <div class="row" style="gap:8px">
      <div id="ref-codigo" class="auth-input" style="text-align:center;font-weight:700;letter-spacing:0.1em;flex:1">Cargando…</div>
      <button type="button" class="btn ghost sm" id="ref-copiar" disabled>Copiar</button>
    </div>
    <button type="button" class="btn accent full mt" id="ref-compartir" disabled>📤 Compartir mi código</button>`;
  const refCodigoEl = referidos.querySelector('#ref-codigo');
  const refCopiarBtn = referidos.querySelector('#ref-copiar');
  const refCompartirBtn = referidos.querySelector('#ref-compartir');
  miCodigoReferido().then((codigo) => {
    refCodigoEl.textContent = codigo;
    const link = `https://nutriruta.app/?ref=${codigo}`;
    refCopiarBtn.disabled = false;
    refCompartirBtn.disabled = false;
    refCopiarBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); toast('Enlace copiado 📋'); }
      catch { toast('No se pudo copiar. Copia el código a mano: ' + codigo); }
    });
    refCompartirBtn.addEventListener('click', async () => {
      const texto = `Estoy usando NutriRuta y quiero invitarte 🌿 Regístrate con mi código y si activas el plan anual yo gano 30 días de Premium gratis: ${link}`;
      if (navigator.share) {
        try { await navigator.share({ title: 'Te invito a NutriRuta', text: texto }); } catch { /* canceló, no es un error */ }
        return;
      }
      try { await navigator.clipboard.writeText(texto); toast('Mensaje copiado — pégalo donde quieras 📋'); }
      catch { toast('No se pudo copiar automáticamente.'); }
    });
  }).catch(() => { refCodigoEl.textContent = 'No se pudo cargar tu código.'; });
  container.appendChild(referidos);

  // NutriCoins: a diferencia de las gemas (100% ganadas con constancia,
  // nunca en venta -- ver header() en app.js), esto SÍ se compra con dinero
  // real. MAQUETA: los paquetes y precios son provisionales, y el botón
  // todavía no cobra nada -- falta crear los productos de compra única en
  // Hotmart (confirmado que soporta microtransacciones) y conectar sus IDs.
  const nutricoinsCard = document.createElement('div');
  nutricoinsCard.className = 'card';
  nutricoinsCard.innerHTML = `
    <div class="spread"><h2>🪙 NutriCoins</h2><span class="small muted">${getState().nutricoins || 0}</span></div>
    <p class="small mt">Se compran con dinero, nunca se ganan -- a diferencia de tus gemas 💎. Sirven para extras puntuales (como preguntas de más a SuSana), nunca para saltarte tu constancia real.</p>
    <button type="button" class="btn ghost full mt" id="btn-comprar-nutricoins">Comprar NutriCoins</button>`;
  nutricoinsCard.querySelector('#btn-comprar-nutricoins').addEventListener('click', () => abrirComprarNutricoins());
  container.appendChild(nutricoinsCard);

  // Canjear el código de un amigo: hasta ahora solo se capturaba de forma
  // automática/silenciosa con "?ref=CODIGO" en el link compartido, ANTES
  // de crear la cuenta -- quien ya tenía cuenta, o recibió el código de
  // palabra (no por link), no tenía dónde escribirlo. validarCodigoReferido()
  // solo confirma que el código exista y no sea el propio; el valor se
  // guarda igual que la captura por URL (user.referidoPor), y la fila real
  // en `referidos` se crea recién al activar el plan anual (hotmart-webhook).
  const canjear = document.createElement('div');
  canjear.className = 'card';
  const yaGuardado = getState().user.referidoPor;
  canjear.innerHTML = `
    <h2>🎟️ ¿Tienes el código de un amigo?</h2>
    <p class="small mb" id="canjear-desc"></p>
    <div class="row" style="gap:8px">
      <input type="text" id="canjear-input" class="auth-input" style="text-align:center;font-weight:700;letter-spacing:0.1em;flex:1" maxlength="6" placeholder="CÓDIGO" value="${esc(yaGuardado || '')}">
      <button type="button" class="btn sm" id="canjear-btn">Canjear</button>
    </div>`;
  const canjearDesc = canjear.querySelector('#canjear-desc');
  const canjearInput = canjear.querySelector('#canjear-input');
  const canjearBtn = canjear.querySelector('#canjear-btn');
  function pintarCanjearDesc() {
    canjearDesc.textContent = getState().user.referidoPor
      ? `Código guardado: ${getState().user.referidoPor}. Actívalo comprando el plan anual.`
      : 'Escribe el código y actívalo con el plan anual.';
  }
  pintarCanjearDesc();
  canjearInput.addEventListener('input', () => {
    canjearInput.value = canjearInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
  });
  canjearBtn.addEventListener('click', async () => {
    const codigo = canjearInput.value.trim();
    if (codigo.length < 6) { toast('Escribe el código completo (6 caracteres).'); return; }
    canjearBtn.disabled = true;
    canjearBtn.textContent = 'Verificando…';
    try {
      const valido = await validarCodigoReferido(codigo);
      if (valido) {
        setState({ user: { ...getState().user, referidoPor: codigo } });
        toast('¡Código aplicado! 🎉 Actívalo con el plan anual.');
        pintarCanjearDesc();
      } else {
        toast('Ese código no existe. Revísalo con tu amigo.');
      }
    } catch (e) {
      toast(e.message && e.message.includes('propio') ? 'Ese es tu propio código 😉' : 'No se pudo verificar. Intenta de nuevo.');
    }
    canjearBtn.disabled = false;
    canjearBtn.textContent = 'Canjear';
  });
  container.appendChild(canjear);
}

// ---------- Califica tu experiencia ----------
function pintarResena(container) {
  // Calificación (visible en vivo en nutriruta.com — vista pública, nunca
  // expone correo ni datos de la cuenta, solo calificación + mini reseña).
  const resena = document.createElement('div');
  resena.className = 'card';
  resena.innerHTML = `
    <h2>🌿 Califica tu experiencia</h2>
    <p class="small mt">Tu calificación y reseña pueden mostrarse en nutriruta.com para ayudar a otras personas a decidir — nunca tu correo ni datos de tu cuenta.</p>
    <div class="row mt" id="resena-hojas" style="gap:4px"></div>
    <textarea id="resena-texto" maxlength="300" rows="3" placeholder="Cuéntanos brevemente qué te ha parecido"
      class="auth-input" style="resize:vertical"></textarea>
    <button class="btn full mt" id="resena-guardar" disabled>Guardar calificación</button>
    <p class="small muted mt" id="resena-estado"></p>`;
  container.appendChild(resena);

  const hojasEl = resena.querySelector('#resena-hojas');
  const textoEl = resena.querySelector('#resena-texto');
  const guardarBtn = resena.querySelector('#resena-guardar');
  const estadoEl = resena.querySelector('#resena-estado');
  let calificacionActual = 0;

  function pintarHojas() {
    hojasEl.innerHTML = '';
    for (let n = 1; n <= 5; n++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `${n} de 5`);
      b.style.cssText = 'font-size:1.6rem;background:none;border:none;cursor:pointer;opacity:' + (n <= calificacionActual ? '1' : '0.3');
      b.textContent = '🍏';
      b.addEventListener('click', () => {
        calificacionActual = n;
        guardarBtn.disabled = false;
        pintarHojas();
      });
      hojasEl.appendChild(b);
    }
  }
  pintarHojas();

  fetchMyResena().then((mia) => {
    if (mia) {
      calificacionActual = mia.calificacion;
      textoEl.value = mia.texto || '';
      guardarBtn.disabled = false;
      estadoEl.textContent = 'Ya calificaste — puedes actualizarla cuando quieras.';
      pintarHojas();
    }
  }).catch(() => {});

  guardarBtn.addEventListener('click', async () => {
    if (!calificacionActual) return;
    guardarBtn.disabled = true;
    guardarBtn.textContent = 'Guardando…';
    try {
      await submitResena(calificacionActual, textoEl.value.trim(), getState().user.nombre);
      toast('¡Gracias por tu calificación! 🌿');
      estadoEl.textContent = 'Ya calificaste — puedes actualizarla cuando quieras.';
    } catch (e) {
      toast('No se pudo guardar. Intenta de nuevo.');
    }
    guardarBtn.disabled = false;
    guardarBtn.textContent = 'Guardar calificación';
  });
}

// ---------- Notificaciones ----------
function pintarNotificaciones(container) {
  if (!pushSupported()) return;
  const notif = document.createElement('div');
  notif.className = 'card';
  notif.innerHTML = `
    <h2>🔔 Notificaciones</h2>
    <p class="small mt">Avisos para acompañarte durante el día. Tú decides cuáles recibir — nada de spam.</p>
    <p class="small mt" id="notif-estado">Consultando…</p>
    <button class="btn full mt" id="notif-btn" disabled>Cargando…</button>
    <div id="notif-prefs" style="display:none">
      <p class="small mt" style="font-weight:600">Qué avisos quieres recibir:</p>
      <label class="habit"><input type="checkbox" data-pref="plan"><span>🏁 Tu plan y tu Ruta <span class="muted small">(día nuevo, check-in, recordatorio suave)</span></span></label>
      <label class="habit"><input type="checkbox" data-pref="comidas"><span>🍽️ Horas de tus comidas <span class="muted small">(a la hora sugerida de cada una)</span></span></label>
      <label class="habit"><input type="checkbox" data-pref="agua"><span>💧 Recordatorios de agua <span class="muted small">(según tu meta personalizada)</span></span></label>
      <button class="btn ghost sm mt" id="notif-test">🔔 Enviar notificación de prueba</button>
    </div>`;
  container.appendChild(notif);
  const estadoEl = notif.querySelector('#notif-estado');
  const btn = notif.querySelector('#notif-btn');
  const prefsBox = notif.querySelector('#notif-prefs');

  function pintarPrefs() {
    const prefs = getState().notifPrefs || {};
    notif.querySelectorAll('[data-pref]').forEach((chk) => {
      chk.checked = prefs[chk.dataset.pref] !== false;
    });
  }
  notif.querySelectorAll('[data-pref]').forEach((chk) => {
    chk.addEventListener('change', () => {
      const prefs = { ...(getState().notifPrefs || {}) };
      prefs[chk.dataset.pref] = chk.checked;
      setState({ notifPrefs: prefs });
      toast(chk.checked ? 'Aviso activado ✅' : 'Aviso desactivado');
    });
  });

  notif.querySelector('#notif-test').addEventListener('click', async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('🌿 NutriRuta', {
        body: '¡Perfecto! Así se verán tus avisos en este dispositivo.',
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png'
      });
    } catch (e) {
      toast('No se pudo mostrar la prueba. Revisa los permisos de notificación.');
    }
  });

  async function pintarEstadoNotif() {
    const sub = await currentSubscription();
    const activas = !!sub && Notification.permission === 'granted';
    estadoEl.textContent = activas ? '✅ Activadas en este dispositivo.' : 'Aún no están activadas en este dispositivo.';
    btn.textContent = activas ? 'Desactivar' : 'Activar notificaciones';
    btn.className = activas ? 'btn ghost full mt' : 'btn full mt';
    btn.disabled = false;
    prefsBox.style.display = activas ? 'block' : 'none';
    if (activas) pintarPrefs();
  }
  pintarEstadoNotif();

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const sub = await currentSubscription();
      if (sub) {
        await disablePush();
        toast('Notificaciones desactivadas.');
      } else {
        await enablePush();
        toast('¡Notificaciones activadas! 🔔');
      }
    } catch (e) {
      toast(e.message || 'No se pudo cambiar el estado de las notificaciones.');
    }
    pintarEstadoNotif();
  });
}

// ---------- Salud y alimentación (perfiles + colon irritable + exclusiones) ----------
function pintarSalud(container) {
  const { user } = getState();

  // Perfiles activos — lista de una sola columna (antes eran chips que se
  // amontonaban sin orden claro al haber varios activos a la vez).
  const perf = document.createElement('div');
  perf.className = 'card';
  perf.innerHTML = '<h2>🩺 Mis perfiles de salud</h2><p class="small mb">Activa o desactiva según tu situación.</p>';
  for (const p of Object.values(PROFILES)) {
    const row = document.createElement('label');
    row.className = 'habit';
    row.innerHTML = `
      <input type="checkbox" ${user.perfiles.includes(p.id) ? 'checked' : ''}>
      <span>${p.emoji} ${p.nombre}</span>`;
    row.querySelector('input').addEventListener('change', (e) => {
      const cur = getState().user;
      const has = cur.perfiles.includes(p.id);
      const perfiles = has ? cur.perfiles.filter((x) => x !== p.id) : [...cur.perfiles, p.id];
      if (!perfiles.length) { toast('Debes mantener al menos un perfil activo.'); e.target.checked = true; return; }
      setState({ user: { ...cur, perfiles } });
    });
    perf.appendChild(row);
  }
  container.appendChild(perf);

  // Colon irritable: síntoma predominante (solo si el perfil está activo)
  if (user.perfiles.includes('colon_irritable')) {
    const colon = document.createElement('div');
    colon.className = 'card';
    colon.innerHTML = '<h2>🌱 Tu colon irritable</h2><p class="small mb">¿Qué predomina en tus síntomas?</p><div class="chips"></div>';
    const colonChips = colon.querySelector('.chips');
    const opciones = [
      { id: 'diarrea', nombre: 'Diarrea' },
      { id: 'estrenimiento', nombre: 'Estreñimiento' },
      { id: 'mixto', nombre: 'Mixto' }
    ];
    for (const o of opciones) {
      const b = document.createElement('button');
      b.className = 'chip' + (user.colonPredominante === o.id ? ' selected' : '');
      b.textContent = o.nombre;
      b.addEventListener('click', () => {
        setState({ user: { ...getState().user, colonPredominante: o.id } });
        colonChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c === b));
      });
      colonChips.appendChild(b);
    }
    container.appendChild(colon);
  }

  // Exclusiones
  const excl = document.createElement('div');
  excl.className = 'card';
  excl.innerHTML = '<h2>🚫 Alimentos que no consumo</h2><p class="small mb">Filtramos recetas y proponemos sustituciones.</p><div class="chips"></div>';
  const exclChips = excl.querySelector('.chips');
  // "Ninguno" es solo para el quiz (evita que el paso quede vacío en la
  // BD) -- en Ajustes no hace falta, aquí ya se ve directo si hay chips
  // marcados o no.
  for (const e of EXCLUSIONS.filter((x) => x.id !== 'ninguna')) {
    const b = document.createElement('button');
    b.className = 'chip' + (user.exclusiones.includes(e.id) ? ' selected' : '');
    b.textContent = `${e.emoji} ${e.nombre}`;
    b.addEventListener('click', () => {
      const cur = getState().user;
      const has = cur.exclusiones.includes(e.id);
      const exclusiones = has ? cur.exclusiones.filter((x) => x !== e.id) : [...cur.exclusiones, e.id];
      setState({ user: { ...cur, exclusiones } });
      b.classList.toggle('selected');
    });
    exclChips.appendChild(b);
  }
  excl.insertAdjacentHTML('beforeend', `
    <label class="muted small mt" for="excl-otro" style="display:block">¿Algo más que no comas? (separa varios con coma)</label>
    <input id="excl-otro" type="text" placeholder="Ej: cilantro, champiñones" maxlength="200" class="auth-input">`);
  const exclOtroInput = excl.querySelector('#excl-otro');
  exclOtroInput.value = (user.exclusionesOtro || []).join(', ');
  exclOtroInput.addEventListener('change', (e) => {
    const exclusionesOtro = e.target.value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10);
    setState({ user: { ...getState().user, exclusionesOtro } });
    toast('Guardado 🌿');
  });
  container.appendChild(excl);
}

// ---------- Sobre ti (peso, sexo, edad, estatura, IMC) ----------
function pintarSobreTi(container) {
  const { user } = getState();
  const peso = document.createElement('div');
  peso.className = 'card';
  const ultimo = ultimoPeso();
  peso.innerHTML = `
    <h2>⚖️ Sobre ti</h2>
    <p class="small mb">Sexo y peso afinan tu meta de agua personalizada (30–35 mL por kg, el rango estándar de nutrición clínica). Edad y estatura se guardan para uso futuro. Es privado: nadie más lo ve, y puedes borrarlo cuando quieras.</p>
    <div class="chips" id="sexo-chips" style="margin-bottom:12px">
      <button type="button" class="chip" data-sexo="mujer">Mujer</button>
      <button type="button" class="chip" data-sexo="hombre">Hombre</button>
    </div>
    <div class="row" style="flex-wrap:wrap;gap:16px 24px">
      <div>
        <label class="muted small" for="edad-input">Edad</label>
        <div class="row" style="align-items:center;gap:8px;margin-top:2px">
          <input id="edad-input" type="number" min="13" max="110" placeholder="Ej: 33" value="${user.edad ?? ''}" class="auth-input" style="width:90px;margin:0">
          <span class="muted small">años</span>
        </div>
      </div>
      <div>
        <label class="muted small" for="estatura-input">Estatura</label>
        <div class="row" style="align-items:center;gap:8px;margin-top:2px">
          <input id="estatura-input" type="number" min="120" max="230" placeholder="Ej: 165" value="${user.estaturaCm ?? ''}" class="auth-input" style="width:90px;margin:0">
          <span class="muted small">cm</span>
        </div>
      </div>
      <div>
        <label class="muted small" for="peso-input">Peso</label>
        <div class="row" style="align-items:center;gap:8px;margin-top:2px">
          <input id="peso-input" type="number" min="30" max="300" step="0.1" placeholder="Ej: 65" value="${user.pesoKg ?? ''}" class="auth-input" style="width:90px;margin:0">
          <span class="muted small">kg</span>
        </div>
      </div>
    </div>
    <button class="btn ghost sm mt" id="peso-guardar">Guardar</button>
    <p class="small mt" id="peso-meta">${user.pesoKg ? `Tu meta de agua con este peso: <strong>${getWaterGoal()} vasos</strong>.` : 'Sin peso registrado, usamos una meta general de 8 vasos.'}</p>
    ${(() => {
      const imc = calcularIMC(user.pesoKg, user.estaturaCm);
      // Con peso + estatura, ademas de la meta de agua, tambien sirve
      // como referencia real si uno de tus objetivos es bajar de peso --
      // formula estandar de la OMS, no inventada, pero con su
      // advertencia real: no distingue musculo de grasa, es solo una
      // referencia, nunca un diagnostico.
      return imc ? `<p class="small mt">Tu IMC: <strong>${imc.valor}</strong> (${imc.categoria}). Es solo una referencia general -- no distingue masa muscular de grasa, no es un diagnóstico.</p>` : '';
    })()}
    <label class="row mt" style="cursor:pointer">
      <input type="checkbox" id="peso-track" ${user.trackearPeso ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--primary)">
      <span class="small">Llevar un registro de mi peso en el tiempo (verás tu tendencia en Progreso)</span>
    </label>
    ${ultimo ? `<p class="muted small mt">Último registro: ${ultimo.kg} kg el ${ultimo.fecha}.</p>` : ''}`;
  let sexoElegido = user.sexo || '';
  peso.querySelectorAll('#sexo-chips .chip').forEach((b) => {
    b.classList.toggle('selected', b.dataset.sexo === sexoElegido);
    b.addEventListener('click', () => {
      sexoElegido = sexoElegido === b.dataset.sexo ? '' : b.dataset.sexo;
      peso.querySelectorAll('#sexo-chips .chip').forEach((c) => c.classList.toggle('selected', c.dataset.sexo === sexoElegido));
    });
  });
  peso.querySelector('#peso-guardar').addEventListener('click', () => {
    const pesoVal = peso.querySelector('#peso-input').value;
    if (pesoVal && !logPeso(pesoVal)) {
      toast('Ingresa un peso válido (entre 30 y 300 kg).');
      return;
    }
    const edadVal = Number(peso.querySelector('#edad-input').value);
    const estaturaVal = Number(peso.querySelector('#estatura-input').value);
    const cur = getState().user;
    setState({
      user: {
        ...cur,
        sexo: sexoElegido || null,
        edad: edadVal >= 13 && edadVal <= 110 ? edadVal : null,
        estaturaCm: estaturaVal >= 120 && estaturaVal <= 230 ? estaturaVal : null
      }
    });
    toast('Guardado 🌿');
    navigate('settings', { seccion: 'sobre-ti' });
  });
  peso.querySelector('#peso-track').addEventListener('change', (e) => {
    setState({ user: { ...getState().user, trackearPeso: e.target.checked } });
  });
  container.appendChild(peso);
}

// ---------- Tus comidas (horarios) ----------
function pintarComidas(container) {
  const { user } = getState();
  // Horario real de tus comidas: antes era una franja fija igual para
  // todo el mundo (7am/10am/12pm/4pm/7pm) — ahora cada quien la ajusta a
  // su rutina real, y "Tu ruta de hoy" usa esto para saber cuál estación
  // es "Ahora".
  const horarios = document.createElement('div');
  horarios.className = 'card';
  // Cuentas creadas antes de que existiera este campo no lo tienen guardado
  // (el merge de estado es superficial a nivel raíz, no rellena dentro de
  // `user`) -- se completa con DEFAULT_HORA_COMIDAS por comida, nunca se
  // deja vacío (eso mostraría 12:00 am seleccionado, que no es el default real).
  const horaComidas = { ...DEFAULT_HORA_COMIDAS, ...(user.horaComidas || {}) };
  // comidasActivas: sin este campo guardado (cuenta creada antes de que
  // existiera, o `activas[id]` simplemente ausente) se asume incluida --
  // sin esto, cuentas viejas perderían comidas de su menú de un día para
  // otro sin haber tocado nada (ver mismo criterio en mealsActivas, menu.js).
  const comidasActivas = user.comidasActivas || {};
  const estaActiva = (id) => comidasActivas[id] !== false;
  // Selector rápido de horarios: 3 horas típicas por comida + "Otro" en
  // vez de un <select> con las 24 horas del día -- toca una vez para el
  // caso común, y solo abre la lista completa si de verdad la hora no
  // está entre las sugeridas (mismo patrón que usa Fitia).
  const HORAS_SUGERIDAS = {
    desayuno: [7, 8, 9], media_manana: [9, 10, 11], almuerzo: [12, 13, 14],
    media_tarde: [16, 17, 18], cena: [18, 19, 20]
  };
  const labelHora = (h) => h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`;
  horarios.innerHTML = `
    <h2>⏰ Horario de comidas</h2>
    <p class="small mb">Cuáles quieres en tu día y a qué hora sueles comer, de verdad — así "Tu ruta de hoy" arma el menú correcto y sabe cuál comida es "Ahora".</p>
    ${MEALS.map((m) => {
      const sugeridas = HORAS_SUGERIDAS[m.id] || [];
      const esOtra = !sugeridas.includes(horaComidas[m.id]);
      return `
      <div class="mt">
        <label class="row" style="align-items:center;gap:8px;cursor:pointer;margin-bottom:8px">
          <input type="checkbox" class="comida-activa" data-meal="${m.id}" ${estaActiva(m.id) ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--primary)">
          <span class="small">${esc(m.emoji)} ${esc(m.nombre)}</span>
        </label>
        <div class="chips" ${estaActiva(m.id) ? '' : 'style="opacity:0.5;pointer-events:none"'}>
          ${sugeridas.map((h) => `<button type="button" class="chip small hora-chip${horaComidas[m.id] === h ? ' selected' : ''}" data-meal="${m.id}" data-hora="${h}">${labelHora(h)}</button>`).join('')}
          <button type="button" class="chip small hora-otro${esOtra ? ' selected' : ''}" data-meal="${m.id}">Otro</button>
        </div>
        <select class="hora-sel mt" data-meal="${m.id}" style="${esOtra ? '' : 'display:none;'}padding:8px;border-radius:10px;border:1.5px solid var(--border);font:inherit;background:var(--card);color:var(--ink)">
          ${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${horaComidas[m.id] === h ? 'selected' : ''}>${h === 0 ? '12:00 am' : h < 12 ? `${h}:00 am` : h === 12 ? '12:00 pm' : `${h - 12}:00 pm`}</option>`).join('')}
        </select>
      </div>`;
    }).join('')}`;
  function guardarHora(mealId, hora) {
    const cur = getState().user;
    const nuevo = { ...DEFAULT_HORA_COMIDAS, ...(cur.horaComidas || {}), [mealId]: hora };
    setState({ user: { ...cur, horaComidas: nuevo } });
    toast('Horario actualizado 🌿');
  }
  horarios.querySelectorAll('.hora-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const meal = chip.dataset.meal;
      horarios.querySelectorAll(`.hora-chip[data-meal="${meal}"], .hora-otro[data-meal="${meal}"]`).forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
      horarios.querySelector(`.hora-sel[data-meal="${meal}"]`).style.display = 'none';
      guardarHora(meal, Number(chip.dataset.hora));
    });
  });
  horarios.querySelectorAll('.hora-otro').forEach((btn) => {
    btn.addEventListener('click', () => {
      const meal = btn.dataset.meal;
      horarios.querySelectorAll(`.hora-chip[data-meal="${meal}"], .hora-otro[data-meal="${meal}"]`).forEach((c) => c.classList.remove('selected'));
      btn.classList.add('selected');
      const sel = horarios.querySelector(`.hora-sel[data-meal="${meal}"]`);
      sel.style.display = '';
      sel.focus();
    });
  });
  horarios.querySelectorAll('.hora-sel').forEach((sel) => {
    sel.addEventListener('change', () => guardarHora(sel.dataset.meal, Number(sel.value)));
  });
  horarios.querySelectorAll('.comida-activa').forEach((chk) => {
    chk.addEventListener('change', () => {
      // Al menos una comida activa siempre -- desactivarlas todas dejaría
      // "Tu ruta de hoy" vacía sin ninguna explicación.
      const activasAhora = MEALS.filter((m) => m.id === chk.dataset.meal ? chk.checked : estaActiva(m.id));
      if (!activasAhora.length) { toast('Debes mantener al menos una comida activa.'); chk.checked = true; return; }
      const cur = getState().user;
      const nuevo = { ...(cur.comidasActivas || {}), [chk.dataset.meal]: chk.checked };
      setState({ user: { ...cur, comidasActivas: nuevo } });
      navigate('settings', { seccion: 'comidas' });
    });
  });
  container.appendChild(horarios);
}

// ---------- Interfaz y preferencias (tema, idioma, unidades, sonido, Ruti) ----------
function pintarInterfaz(container) {
  const { user } = getState();
  // Tema + Interfaz y Unidades — filas de lista compacta (ícono + valor +
  // flecha) que abren un selector chico al tocarlas, en vez de chips
  // grandes apiladas: mismo patrón que usan apps de referencia (Fitia) y
  // consistente con las demás filas de la app (.habit). setTema/setState
  // aplican el cambio al instante; solo se actualiza la fila donde estás
  // parada, nunca se navega a ningún lado.
  const TEMAS = [
    { id: 'sistema', label: 'Sistema del dispositivo' },
    { id: 'claro', label: 'Claro' },
    { id: 'oscuro', label: 'Oscuro' }
  ];
  const IDIOMAS_INTERFAZ = [{ id: 'es', label: 'Español' }, { id: 'en', label: 'English' }];
  const UNIDADES = [
    { id: 'metrico', label: 'Métrico (g, ml)' },
    { id: 'imperial', label: 'Imperial (oz, lb, cups)' }
  ];

  const prefsCard = document.createElement('div');
  prefsCard.className = 'card';
  prefsCard.innerHTML = '<h2>🌎 Interfaz y preferencias</h2>';

  let temaActual = TEMAS.find((t) => t.id === getTema()) || TEMAS[0];
  const temaRow = filaAjuste('🎨', 'Tema', temaActual.label, () => {
    abrirSelector('Tema', TEMAS, temaActual.id, (id) => {
      setTema(id);
      temaActual = TEMAS.find((t) => t.id === id) || TEMAS[0];
      temaRow.querySelector('.setting-row-value').textContent = temaActual.label;
    });
  });
  prefsCard.appendChild(temaRow);

  let idiomaActual = IDIOMAS_INTERFAZ.find((i) => i.id === (user.idiomaInterfaz || 'es'));
  const idiomaRow = filaAjuste('🗣️', 'Idioma de interfaz', idiomaActual.label, () => {
    abrirSelector('Idioma de interfaz', IDIOMAS_INTERFAZ, idiomaActual.id, (id) => {
      setState({ user: { ...getState().user, idiomaInterfaz: id } });
      idiomaActual = IDIOMAS_INTERFAZ.find((i) => i.id === id) || IDIOMAS_INTERFAZ[0];
      idiomaRow.querySelector('.setting-row-value').textContent = idiomaActual.label;
    });
  });
  prefsCard.appendChild(idiomaRow);

  prefsCard.appendChild(filaAjuste('🍽️', 'Idioma de alimentos', 'Español', () => {
    toast('English para las recetas llega pronto — por ahora solo están en español.');
  }));

  let unidadActual = UNIDADES.find((u) => u.id === (user.unidades || 'metrico'));
  const unidadRow = filaAjuste('📏', 'Unidades', unidadActual.label, () => {
    abrirSelector('Unidades', UNIDADES, unidadActual.id, (id) => {
      setState({ user: { ...getState().user, unidades: id } });
      unidadActual = UNIDADES.find((u) => u.id === id) || UNIDADES[0];
      unidadRow.querySelector('.setting-row-value').textContent = unidadActual.label;
    });
  });
  prefsCard.appendChild(unidadRow);
  container.appendChild(prefsCard);

  // Sonido + Ruti: antes una tarjeta entera por cada interruptor (mucho
  // encabezado repetido para un solo toggle cada una) -- agrupadas en una
  // sola tarjeta de preferencias, mismo patrón que "Funciones Inteligentes"
  // de Fitia (varios toggles juntos, no uno por tarjeta).
  const prefsToggles = document.createElement('div');
  prefsToggles.className = 'card';
  prefsToggles.innerHTML = `
    <h2>🔊 Sonido y Ruti</h2>
    <label class="habit">
      <input type="checkbox" id="sonido-toggle" ${getState().sonidoActivado !== false ? 'checked' : ''}>
      <span>🔊 Sonido al marcar hábitos, agua o "Tu paso de hoy"</span>
    </label>
    <label class="habit" style="border-bottom:none">
      <input type="checkbox" id="ruti-oculto-toggle" ${getState().rutiOculto ? 'checked' : ''}>
      <span>🦦 Ocultar a Ruti (modo minimalista)</span>
    </label>`;
  prefsToggles.querySelector('#sonido-toggle').addEventListener('change', (e) => {
    setState({ sonidoActivado: e.target.checked });
    toast(e.target.checked ? 'Sonido activado 🔊' : 'Sonido desactivado');
  });
  prefsToggles.querySelector('#ruti-oculto-toggle').addEventListener('change', (e) => {
    setState({ rutiOculto: e.target.checked });
    toast(e.target.checked ? 'Ruti ya no aparecerá en la app' : '¡Ruti está de vuelta! 🦦');
  });
  container.appendChild(prefsToggles);
}

// ---------- Cuenta y datos ----------
function pintarDatos(container) {
  const actions = document.createElement('div');
  actions.className = 'card';
  actions.innerHTML = `<h2>${GEAR_ICON} Cuenta y datos</h2>`;
  const redoBtn = document.createElement('button');
  redoBtn.className = 'btn ghost full mb';
  redoBtn.textContent = '📝 Rehacer el quiz inicial';
  redoBtn.addEventListener('click', () => navigate('quiz'));
  actions.appendChild(redoBtn);

  // Repetir el minitutorial guiado (ver views/tour.js) -- se llama a
  // iniciarTour() directo, sin pasar por tourVisible() (esa función solo
  // deja verlo a cuentas sin ningún día completado; aquí es un repaso
  // deliberado, debe funcionar sin importar cuánto tiempo lleve usando
  // la app).
  const tourBtn = document.createElement('button');
  tourBtn.className = 'btn ghost full mb';
  tourBtn.textContent = '🧭 Ver el tutorial de nuevo';
  tourBtn.addEventListener('click', () => {
    navigate('dashboard');
    if (!document.querySelector('.tour-overlay')) iniciarTour();
  });
  actions.appendChild(tourBtn);

  // Exportar datos: descarga un JSON con todo lo que guarda tu cuenta --
  // el mismo respaldo del que habla Privacidad ("puedes borrar tus
  // datos..."), aquí como copia que te puedes llevar antes de borrar,
  // cambiar de cuenta o solo para tenerla.
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn ghost full mb';
  exportBtn.textContent = '📤 Exportar mis datos';
  exportBtn.addEventListener('click', () => {
    const datos = getState();
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutriruta-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Descarga lista 📤');
  });
  actions.appendChild(exportBtn);

  const wipeBtn = document.createElement('button');
  wipeBtn.className = 'btn danger full';
  wipeBtn.textContent = '🗑️ Borrar todos mis datos';
  wipeBtn.addEventListener('click', () => openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <h2>¿Borrar todo?</h2>
      <p class="mt">Se eliminarán tu perfil, progreso, Días en Ruta y registros de este dispositivo. Esta acción no se puede deshacer.</p>`);
    const yes = document.createElement('button');
    yes.className = 'btn danger full mt';
    yes.textContent = 'Sí, borrar todo';
    yes.addEventListener('click', () => {
      resetState();
      pushProfileState({}, '').catch(() => {}); // también vacía la copia en la nube
      close();
      navigate('quiz');
      toast('Datos eliminados. Empecemos de nuevo 🌿');
    });
    modal.appendChild(yes);
  }));
  actions.appendChild(wipeBtn);
  container.appendChild(actions);
}

// ---------- Legal ----------
function pintarLegal(container) {
  const legal = document.createElement('div');
  legal.className = 'card';
  legal.innerHTML = '<h2>⚖️ Legal</h2>';
  const sections = [
    ['📄 Términos de uso', TERMS],
    ['🔒 Privacidad y datos', PRIVACY],
    ['🩺 Descargo médico', DISCLAIMER]
  ];
  for (const [label, text] of sections) {
    const b = document.createElement('button');
    b.className = 'recipe-item lesson-item';
    b.innerHTML = `<span class="info"><strong>${label}</strong></span><span>›</span>`;
    b.addEventListener('click', () => openModal((modal) => {
      modal.insertAdjacentHTML('beforeend', text);
    }));
    legal.appendChild(b);
  }
  container.appendChild(legal);
}

const TERMS = `
  <h2>Términos de uso</h2>
  <p class="mt">NutriRuta ofrece contenido educativo, herramientas de autoayuda y recomendaciones generales de hábitos saludables en nutrición, hidratación y estilo de vida.</p>
  <p class="mt"><strong>Qué hace la app:</strong> personaliza menús, recetas, recordatorios y contenido educativo según los perfiles y preferencias que tú configuras.</p>
  <p class="mt"><strong>Qué NO hace la app:</strong> no diagnostica, no prescribe tratamientos ni medicación, y no sustituye el criterio de un profesional de la salud. No garantiza resultados médicos específicos, pues dependen de factores individuales.</p>
  <p class="mt">Las recomendaciones son generales y deben adaptarse con apoyo profesional si tienes enfermedades, tomas medicación o estás en embarazo o lactancia. Eres responsable de verificar con tu profesional de salud cualquier cambio importante en dieta o ejercicio.</p>
  <p class="mt">La app puede actualizar sus contenidos y funcionalidades buscando siempre mejorar la experiencia.</p>`;

const PRIVACY = `
  <h2>Privacidad y tratamiento de datos</h2>
  <p class="mt"><strong>Qué datos se usan:</strong> nombre o alias opcional, objetivos, respuestas del quiz, preferencias y exclusiones alimentarias, y registros de uso (agua, hábitos, antojos).</p>
  <p class="mt"><strong>Dónde se guardan:</strong> en tu dispositivo (para que la app funcione sin conexión) y en tu cuenta personal en la nube (Supabase), siempre cifrados en tránsito. Cada cuenta está aislada mediante reglas de acceso por usuario (Row Level Security): nadie más puede leer tus datos. No se comparten con terceros ni se venden.</p>
  <p class="mt"><strong>Autenticación:</strong> tu sesión usa tokens JWT de corta duración con renovación automática; tu contraseña nunca se guarda en texto plano (se almacena con hash bcrypt).</p>
  <p class="mt"><strong>Datos de salud:</strong> son sensibles; se usan solo para personalizar tu experiencia dentro de la app.</p>
  <p class="mt"><strong>Tu control:</strong> puedes borrar todos tus datos en cualquier momento desde Ajustes → “Borrar todos mis datos”, lo que también vacía tu copia en la nube.</p>`;

const DISCLAIMER = `
  <h2>Descargo de responsabilidad médica</h2>
  <p class="mt">Esta aplicación es una herramienta de autoayuda basada en buenas prácticas de hábitos saludables. <strong>No reemplaza el consejo ni el seguimiento de un médico, nutricionista, psicólogo u otro profesional de salud.</strong></p>
  <p class="mt">Si tienes diagnósticos, medicación o síntomas importantes, consulta siempre con tu profesional de confianza. Ante síntomas graves, busca atención médica de inmediato.</p>
  <p class="mt">Usa NutriRuta como complemento, nunca como sustituto, de la atención profesional.</p>`;
