// Ajustes: cuenta, perfiles, exclusiones, quiz, datos y sección legal.
import { getState, setState, resetState, getPlan, isPremium, planExpired, planExpiry, esc, logPeso, ultimoPeso, getWaterGoal } from '../store.js';
import { PROFILES, EXCLUSIONS } from '../data/profiles.js';
import { getSession, signOut, pushProfileState, fetchMyResena, submitResena, uploadAvatar, avatarUrlFor } from '../supabase-client.js';
import { navigate, header, openModal, toast } from '../app.js';
import { pushSupported, currentSubscription, enablePush, disablePush } from '../push.js';

export function renderSettings(container) {
  header(container);
  const { user } = getState();

  // Cuenta y plan
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
      avatarEstado.textContent = err.message && err.message.includes('demasiado grande')
        ? err.message
        : 'No se pudo subir la foto. Intenta de nuevo.';
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
  // Enlace discreto: el servidor decide quién entra (admin_dashboard), no
  // esta pantalla — mostrarlo a todas es inofensivo, no revela nada. Vive
  // aquí, junto a la cuenta, en vez de hasta el final de Ajustes (ahí
  // costaba encontrarlo, tras una lista larga de tarjetas).
  const adminLink = document.createElement('button');
  adminLink.className = 'link-btn small center';
  adminLink.style.display = 'block';
  adminLink.style.width = '100%';
  adminLink.style.marginTop = '10px';
  adminLink.textContent = 'Panel de administración';
  adminLink.addEventListener('click', () => navigate('admin'));
  account.appendChild(adminLink);
  container.appendChild(account);

  // Calificación (visible en vivo en nutriruta.com — vista pública, nunca
  // expone correo ni datos de la cuenta, solo calificación + mini reseña).
  const resena = document.createElement('div');
  resena.className = 'card';
  resena.innerHTML = `
    <h2>🌿 Califica tu experiencia</h2>
    <p class="small mt">Tu calificación y reseña pueden mostrarse en nutriruta.com para ayudar a otras personas a decidir — nunca tu correo ni datos de tu cuenta.</p>
    <div class="row mt" id="resena-hojas" style="gap:4px"></div>
    <textarea id="resena-texto" maxlength="300" rows="3" placeholder="Cuéntanos brevemente qué te ha parecido (opcional)"
      style="width:100%;padding:12px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit;margin-top:10px;resize:vertical"></textarea>
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

  // Notificaciones push
  if (pushSupported()) {
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

  // Sonido: chime corto al completar una micro-acción (hábito, agua, paso del día)
  const sonido = document.createElement('div');
  sonido.className = 'card';
  sonido.innerHTML = `
    <div class="spread"><h2>🔊 Sonido</h2></div>
    <label class="habit" style="border-bottom:none">
      <input type="checkbox" id="sonido-toggle" ${getState().sonidoActivado !== false ? 'checked' : ''}>
      <span>Chime al marcar hábitos, agua o "Tu paso de hoy"</span>
    </label>`;
  sonido.querySelector('#sonido-toggle').addEventListener('change', (e) => {
    setState({ sonidoActivado: e.target.checked });
    toast(e.target.checked ? 'Sonido activado 🔊' : 'Sonido desactivado');
  });
  container.appendChild(sonido);

  // Ruti: modo minimalista, sin la mascota — la app sigue funcionando
  // igual, solo deja de mostrarla donde aparece.
  const rutiCard = document.createElement('div');
  rutiCard.className = 'card';
  rutiCard.innerHTML = `
    <div class="spread"><h2>🦦 Ruti</h2></div>
    <label class="habit" style="border-bottom:none">
      <input type="checkbox" id="ruti-oculto-toggle" ${getState().rutiOculto ? 'checked' : ''}>
      <span>Ocultar a Ruti (modo minimalista)</span>
    </label>`;
  rutiCard.querySelector('#ruti-oculto-toggle').addEventListener('change', (e) => {
    setState({ rutiOculto: e.target.checked });
    toast(e.target.checked ? 'Ruti ya no aparecerá en la app' : '¡Ruti está de vuelta! 🦦');
  });
  container.appendChild(rutiCard);

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

  // Peso (opcional, apagado por defecto): solo se usa para calcular tu meta de agua.
  const peso = document.createElement('div');
  peso.className = 'card';
  const ultimo = ultimoPeso();
  peso.innerHTML = `
    <h2>⚖️ Mi peso (opcional)</h2>
    <p class="small mb">Solo lo usamos para calcular tu meta de agua personalizada (30–35 mL por kg, el rango estándar de nutrición clínica). Es privado: nadie más lo ve, y puedes borrarlo cuando quieras.</p>
    <div class="row">
      <input id="peso-input" type="number" min="30" max="300" step="0.1" placeholder="Ej: 65" value="${user.pesoKg ?? ''}"
        style="width:100px;padding:10px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit">
      <span class="muted small">kg</span>
      <button class="btn ghost sm" id="peso-guardar">Guardar</button>
    </div>
    <p class="small mt" id="peso-meta">${user.pesoKg ? `Tu meta de agua con este peso: <strong>${getWaterGoal()} vasos</strong>.` : 'Sin peso registrado, usamos una meta general de 8 vasos.'}</p>
    <label class="row mt" style="cursor:pointer">
      <input type="checkbox" id="peso-track" ${user.trackearPeso ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--primary)">
      <span class="small">Llevar un registro de mi peso en el tiempo (opcional, verás tu tendencia en Progreso)</span>
    </label>
    ${ultimo ? `<p class="muted small mt">Último registro: ${ultimo.kg} kg el ${ultimo.fecha}.</p>` : ''}`;
  peso.querySelector('#peso-guardar').addEventListener('click', () => {
    const val = peso.querySelector('#peso-input').value;
    if (logPeso(val)) {
      toast('Peso guardado 🌿');
      navigate('settings');
    } else {
      toast('Ingresa un peso válido (entre 30 y 300 kg).');
    }
  });
  peso.querySelector('#peso-track').addEventListener('change', (e) => {
    setState({ user: { ...getState().user, trackearPeso: e.target.checked } });
  });
  container.appendChild(peso);

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
  for (const e of EXCLUSIONS) {
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
    <input id="excl-otro" type="text" placeholder="Ej: cilantro, champiñones" maxlength="200"
      style="width:100%;padding:12px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit;margin-top:6px">`);
  const exclOtroInput = excl.querySelector('#excl-otro');
  exclOtroInput.value = (user.exclusionesOtro || []).join(', ');
  exclOtroInput.addEventListener('change', (e) => {
    const exclusionesOtro = e.target.value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10);
    setState({ user: { ...getState().user, exclusionesOtro } });
    toast('Guardado 🌿');
  });
  container.appendChild(excl);

  // Acciones
  const actions = document.createElement('div');
  actions.className = 'card';
  actions.innerHTML = '<h2>⚙️ Cuenta y datos</h2>';
  const redoBtn = document.createElement('button');
  redoBtn.className = 'btn ghost full mb';
  redoBtn.textContent = '📝 Rehacer el quiz inicial';
  redoBtn.addEventListener('click', () => navigate('quiz'));
  actions.appendChild(redoBtn);

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

  // Legal
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

  const ver = document.createElement('p');
  ver.className = 'muted small center mt';
  ver.textContent = 'NutriRuta v2.1 · Hecha con 💚 para tu bienestar';
  container.appendChild(ver);
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
