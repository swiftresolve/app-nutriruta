// Ajustes: cuenta, perfiles, exclusiones, quiz, datos y sección legal.
import { getState, setState, resetState, getPlan, isPremium, planExpired, planExpiry, esc, logPeso, ultimoPeso, getWaterGoal } from '../store.js';
import { PROFILES, EXCLUSIONS } from '../data/profiles.js';
import { getSession, signOut, pushProfileState } from '../supabase-client.js';
import { navigate, header, openModal, toast } from '../app.js';

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
  account.innerHTML = `
    <h2>👤 Mi cuenta</h2>
    <p class="small" id="acc-email">Cargando…</p>
    <p class="mt">${planHtml}</p>`;
  getSession().then((s) => {
    const el = account.querySelector('#acc-email');
    if (el) el.innerHTML = s ? `Sesión iniciada como <strong>${esc(s.user.email)}</strong> 🔐` : 'Sin sesión activa.';
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
  container.appendChild(account);

  // Perfiles activos
  const perf = document.createElement('div');
  perf.className = 'card';
  perf.innerHTML = '<h2>🩺 Mis perfiles de salud</h2><p class="small mb">Activa o desactiva según tu situación.</p><div class="chips"></div>';
  const perfChips = perf.querySelector('.chips');
  for (const p of Object.values(PROFILES)) {
    const b = document.createElement('button');
    b.className = 'chip' + (user.perfiles.includes(p.id) ? ' selected' : '');
    b.textContent = `${p.emoji} ${p.nombre}`;
    b.addEventListener('click', () => {
      const cur = getState().user;
      const has = cur.perfiles.includes(p.id);
      const perfiles = has ? cur.perfiles.filter((x) => x !== p.id) : [...cur.perfiles, p.id];
      if (!perfiles.length) { toast('Debes mantener al menos un perfil activo.'); return; }
      setState({ user: { ...cur, perfiles } });
      b.classList.toggle('selected');
    });
    perfChips.appendChild(b);
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
      <p class="mt">Se eliminarán tu perfil, progreso, rachas y registros de este dispositivo. Esta acción no se puede deshacer.</p>`);
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
