// Ajustes: perfiles, exclusiones, quiz, datos y sección legal.
import { getState, setState, resetState } from '../store.js';
import { PROFILES, EXCLUSIONS } from '../data/profiles.js';
import { navigate, header, openModal, toast } from '../app.js';

export function renderSettings(container) {
  header(container);
  const { user } = getState();

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
  ver.textContent = 'NutrAlma v1.0 · Hecha con 💚 para tu bienestar';
  container.appendChild(ver);
}

const TERMS = `
  <h2>Términos de uso</h2>
  <p class="mt">NutrAlma ofrece contenido educativo, herramientas de autoayuda y recomendaciones generales de hábitos saludables en nutrición, hidratación y estilo de vida.</p>
  <p class="mt"><strong>Qué hace la app:</strong> personaliza menús, recetas, recordatorios y contenido educativo según los perfiles y preferencias que tú configuras.</p>
  <p class="mt"><strong>Qué NO hace la app:</strong> no diagnostica, no prescribe tratamientos ni medicación, y no sustituye el criterio de un profesional de la salud. No garantiza resultados médicos específicos, pues dependen de factores individuales.</p>
  <p class="mt">Las recomendaciones son generales y deben adaptarse con apoyo profesional si tienes enfermedades, tomas medicación o estás en embarazo o lactancia. Eres responsable de verificar con tu profesional de salud cualquier cambio importante en dieta o ejercicio.</p>
  <p class="mt">La app puede actualizar sus contenidos y funcionalidades buscando siempre mejorar la experiencia.</p>`;

const PRIVACY = `
  <h2>Privacidad y tratamiento de datos</h2>
  <p class="mt"><strong>Qué datos se usan:</strong> nombre o alias opcional, objetivos, respuestas del quiz, preferencias y exclusiones alimentarias, y registros de uso (agua, hábitos, antojos).</p>
  <p class="mt"><strong>Dónde se guardan:</strong> únicamente en tu dispositivo (almacenamiento local del navegador). Esta versión de NutrAlma no envía tus datos a ningún servidor ni los comparte con terceros.</p>
  <p class="mt"><strong>Datos de salud:</strong> son sensibles; se usan solo para personalizar tu experiencia dentro de la app.</p>
  <p class="mt"><strong>Tu control:</strong> puedes borrar todos tus datos en cualquier momento desde Ajustes → “Borrar todos mis datos”.</p>`;

const DISCLAIMER = `
  <h2>Descargo de responsabilidad médica</h2>
  <p class="mt">Esta aplicación es una herramienta de autoayuda basada en buenas prácticas de hábitos saludables. <strong>No reemplaza el consejo ni el seguimiento de un médico, nutricionista, psicólogo u otro profesional de salud.</strong></p>
  <p class="mt">Si tienes diagnósticos, medicación o síntomas importantes, consulta siempre con tu profesional de confianza. Ante síntomas graves, busca atención médica de inmediato.</p>
  <p class="mt">Usa NutrAlma como complemento, nunca como sustituto, de la atención profesional.</p>`;
