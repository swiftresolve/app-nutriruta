// Quiz inicial de personalización (onboarding).
import { getState, setState, esc, today } from '../store.js';
import { PROFILES, EXCLUSIONS, GOALS, HARD_HABITS } from '../data/profiles.js';
import { navigate } from '../app.js';
import { rutiMascot } from '../mascot.js';

const CONDITIONS = [
  { id: 'higado_graso', nombre: 'Hígado graso', emoji: '🫀' },
  { id: 'resistencia_insulina', nombre: 'Resistencia a la insulina', emoji: '🩸' },
  { id: 'prediabetes', nombre: 'Prediabetes', emoji: '🛡️' },
  { id: 'colesterol', nombre: 'Colesterol alto', emoji: '❤️' },
  { id: 'colon_irritable', nombre: 'Colon irritable', emoji: '🌱' },
  { id: 'gases', nombre: 'Gases / hinchazón frecuente', emoji: '🎈' },
  { id: 'estrenimiento', nombre: 'Estreñimiento', emoji: '🚰' },
  { id: 'candidiasis', nombre: 'Candidiasis', emoji: '🌸' },
  { id: 'migranas', nombre: 'Migrañas', emoji: '🧠' },
  { id: 'sop', nombre: 'SOP / tema hormonal', emoji: '🌺' },
  { id: 'ninguna', nombre: 'Ninguna diagnosticada', emoji: '✅' }
];

const ACTIVITY = [
  { id: 'bajo', nombre: 'Bajo (casi no me muevo)' },
  { id: 'medio', nombre: 'Medio (camino / algo de ejercicio)' },
  { id: 'alto', nombre: 'Alto (ejercicio frecuente)' }
];

const FREQ_OPTIONS = [
  { id: 'nunca', nombre: 'Nunca' },
  { id: 'casi_nunca', nombre: 'Casi nunca' },
  { id: 'a_veces', nombre: 'A veces' },
  { id: 'frecuente', nombre: 'Frecuente' },
  { id: 'muy_frecuente', nombre: 'Muy frecuente' }
];

// Deriva perfiles activos a partir de las respuestas.
function deriveProfiles(a) {
  const p = new Set();
  for (const c of a.condiciones) {
    if (c === 'sop') p.add('resistencia_insulina'); // SOP se maneja con reglas de RI
    else if (c !== 'ninguna' && PROFILES[c]) p.add(c);
  }
  if (a.objetivos.includes('azucar') || a.azucarFreq === 'muy_frecuente') p.add('resistencia_insulina');
  if (a.alcoholFreq === 'frecuente' || a.alcoholFreq === 'muy_frecuente') p.add('higado_graso');
  if (a.objetivos.includes('colesterol')) p.add('colesterol');
  if (a.objetivos.includes('migranas')) p.add('migranas');
  if (a.objetivos.includes('digestion') && !p.size) p.add('colon_irritable');
  if (a.objetivos.includes('hormonas')) p.add('resistencia_insulina');
  if (!p.size) p.add('resistencia_insulina'); // base preventiva multiperfil
  return [...p];
}

export function renderQuiz(container) {
  // Prellenar con lo ya conocido (p. ej. el nombre dado al registrarse).
  const known = getState().user;
  const answers = {
    nombre: known.nombre || '', objetivos: [], condiciones: [], exclusiones: [], exclusionesOtroTexto: '',
    // Sin valor por defecto: ninguna opción debe verse preseleccionada,
    // la usuaria elige de verdad cada respuesta.
    habitosDificiles: [], actividad: '', azucarFreq: '', alcoholFreq: '',
    pesoKg: known.pesoKg || ''
  };
  let step = 0;

  const steps = [
    {
      title: '¡Hola! 🌿 Empecemos con NutriRuta',
      sub: 'Vamos a conocerte un poco para personalizar tu experiencia. Esto no reemplaza una consulta médica, pero nos ayuda a darte mejores recomendaciones.',
      render(el) {
        el.innerHTML = `
          <div class="center mb">${rutiMascot('saludo', { size: 64 })}</div>
          <p class="center small" style="font-weight:600">Hola, soy Ruti. Vamos a encontrar una Ruta que funcione para ti.</p>
          <label class="muted mt" for="q-nombre" style="display:block">${answers.nombre ? `Te llamaremos <strong>${esc(answers.nombre)}</strong>. Puedes cambiarlo si quieres:` : '¿Cómo te llamas? (opcional)'}</label>
          <input id="q-nombre" type="text" placeholder="Tu nombre o alias" maxlength="60"
            style="width:100%;padding:12px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit;margin-top:8px">
          <div class="legal-note">🔒 Tus datos se guardan en tu cuenta protegida y solo tú puedes verlos. NutriRuta es una herramienta de autoayuda: no diagnostica ni reemplaza a tu médico o nutricionista.</div>`;
        const input = el.querySelector('#q-nombre');
        input.value = answers.nombre; // asignación por propiedad: sin riesgo de inyección HTML
        input.addEventListener('input', (e) => { answers.nombre = e.target.value.trim(); });
      }
    },
    {
      title: '¿Qué quieres lograr?',
      sub: 'Elige todo lo que aplique.',
      render: (el) => chips(el, GOALS, answers.objetivos, true)
    },
    {
      title: '¿Tienes alguna condición conocida?',
      sub: 'Solo si te la han mencionado en un chequeo. Puedes elegir varias.',
      render: (el) => chips(el, CONDITIONS, answers.condiciones, true)
    },
    {
      title: '¿Qué alimentos no consumes?',
      sub: 'Alergias, intolerancias o preferencias. Adaptaremos recetas y sustituciones.',
      render(el) {
        chips(el, EXCLUSIONS, answers.exclusiones, true);
        el.insertAdjacentHTML('beforeend', `
          <label class="muted small mt" for="q-excl-otro" style="display:block">¿Algo más que no comas? (opcional, separa varios con coma)</label>
          <input id="q-excl-otro" type="text" placeholder="Ej: cilantro, champiñones" maxlength="200"
            style="width:100%;padding:12px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit;margin-top:6px">`);
        const input = el.querySelector('#q-excl-otro');
        input.value = answers.exclusionesOtroTexto;
        input.addEventListener('input', (e) => { answers.exclusionesOtroTexto = e.target.value; });
      }
    },
    {
      title: '¿Con cuáles de estos retos te identificas?',
      sub: 'Marca lo que te pasa hoy en día. Sin culpa: nos ayuda a acompañarte mejor.',
      render: (el) => chips(el, HARD_HABITS, answers.habitosDificiles, true, undefined, true)
    },
    {
      title: '¿Tu nivel de actividad física?',
      sub: '',
      render: (el) => chips(el, ACTIVITY, answers, false, 'actividad', true)
    },
    {
      title: '¿Cuál es tu peso? (opcional)',
      sub: 'Solo lo usamos para calcular tu meta diaria de agua, personalizada según tu cuerpo (30–35 mL por kg). Puedes dejarlo en blanco y usamos una meta general.',
      render(el) {
        el.innerHTML = `
          <div class="row" style="align-items:center;gap:10px">
            <input id="q-peso" type="number" inputmode="numeric" min="30" max="300" placeholder="Ej: 65"
              style="width:120px;padding:12px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit">
            <span class="muted">kg</span>
          </div>
          <div class="legal-note">🔒 Es privado, nadie más lo ve, y puedes borrarlo cuando quieras desde Ajustes.</div>`;
        const input = el.querySelector('#q-peso');
        input.value = answers.pesoKg;
        input.addEventListener('input', (e) => { answers.pesoKg = e.target.value; });
      }
    },
    {
      title: '¿Con qué frecuencia consumes azúcar?',
      sub: 'Gaseosas, jugos industriales, postres, dulces, panadería…',
      render: (el) => chips(el, FREQ_OPTIONS, answers, false, 'azucarFreq')
    },
    {
      title: '¿Con qué frecuencia consumes alcohol?',
      sub: 'Cerveza, vino, licores… Si no tomas, elige "Nunca".',
      render: (el) => chips(el, FREQ_OPTIONS, answers, false, 'alcoholFreq')
    }
  ];

  function chips(el, options, target, multi, prop, oneCol) {
    const wrap = document.createElement('div');
    wrap.className = 'chips' + (oneCol ? ' chips-1col' : '');
    for (const opt of options) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = `${opt.emoji ? opt.emoji + ' ' : ''}${opt.nombre}`;
      const isSel = () => multi ? target.includes(opt.id) : target[prop] === opt.id;
      b.classList.toggle('selected', isSel());
      b.addEventListener('click', () => {
        if (multi) {
          if (opt.id === 'ninguna') { target.length = 0; target.push('ninguna'); }
          else {
            const i = target.indexOf('ninguna'); if (i >= 0) target.splice(i, 1);
            const j = target.indexOf(opt.id);
            j >= 0 ? target.splice(j, 1) : target.push(opt.id);
          }
          wrap.querySelectorAll('.chip').forEach((c, k) => c.classList.toggle('selected', target.includes(options[k].id)));
        } else {
          target[prop] = opt.id;
          wrap.querySelectorAll('.chip').forEach((c, k) => c.classList.toggle('selected', options[k].id === target[prop]));
        }
      });
      wrap.appendChild(b);
    }
    el.appendChild(wrap);
  }

  function draw() {
    container.innerHTML = '';
    const s = steps[step];
    const pct = Math.round(((step + 1) / (steps.length + 1)) * 100);
    const view = document.createElement('div');
    view.className = 'quiz-step';
    view.innerHTML = `
      <div class="quiz-progress"><div style="width:${pct}%"></div></div>
      <h2>${s.title}</h2>
      ${s.sub ? `<p>${s.sub}</p>` : ''}
      <div class="step-body"></div>
      <div class="quiz-nav"></div>`;
    s.render(view.querySelector('.step-body'));

    const navEl = view.querySelector('.quiz-nav');
    if (step > 0) {
      const back = document.createElement('button');
      back.className = 'btn ghost'; back.textContent = 'Atrás';
      back.addEventListener('click', () => { step--; draw(); });
      navEl.appendChild(back);
    }
    const next = document.createElement('button');
    next.className = 'btn'; next.textContent = step === steps.length - 1 ? 'Ver mi resultado ✨' : 'Siguiente';
    next.addEventListener('click', () => {
      if (step === steps.length - 1) result(); else { step++; draw(); }
    });
    navEl.appendChild(next);
    container.appendChild(view);
  }

  function result() {
    const perfiles = deriveProfiles(answers);
    const pesoValido = Number(answers.pesoKg);
    const exclusionesOtro = answers.exclusionesOtroTexto
      .split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10);
    setState({
      onboarded: true,
      user: {
        nombre: answers.nombre,
        objetivos: answers.objetivos,
        perfiles,
        exclusiones: answers.exclusiones,
        exclusionesOtro,
        habitosDificiles: answers.habitosDificiles,
        actividad: answers.actividad,
        azucarFreq: answers.azucarFreq,
        alcoholFreq: answers.alcoholFreq,
        pesoKg: pesoValido >= 30 && pesoValido <= 300 ? pesoValido : null,
        trackearPeso: false
      }
    });

    const [main, ...rest] = perfiles;
    const prioridades = [];
    if (answers.azucarFreq === 'frecuente' || answers.azucarFreq === 'muy_frecuente') prioridades.push('Reducir el azúcar líquido (jugos y gaseosas)');
    if (answers.alcoholFreq === 'frecuente' || answers.alcoholFreq === 'muy_frecuente') prioridades.push('Reducir el alcohol de forma gradual (tu hígado lo agradecerá)');
    if (answers.habitosDificiles.includes('poca_agua')) prioridades.push('Llegar a tu meta diaria de agua');
    prioridades.push('Proteína en el desayuno todos los días');
    if (answers.actividad === 'bajo') prioridades.push('Caminar 30 minutos, 5 días a la semana');

    armandoPlan(main, prioridades.slice(0, 3), () => mostrarResultado(main, rest, prioridades.slice(0, 3)));
  }

  // Breve pantalla de "construyendo tu plan" que va revelando, uno a uno,
  // los datos reales que ya se calcularon arriba — nada inventado, solo
  // ritmo: da la sensación de personalización antes de aterrizar en el
  // resultado (igual patrón que usan Duolingo/MateFlex en su onboarding).
  function armandoPlan(main, prioridades, onDone) {
    container.innerHTML = '';
    const view = document.createElement('div');
    view.className = 'quiz-step center';
    const nombreTxt = answers.nombre ? `, ${esc(answers.nombre)}` : '';
    const items = [
      `Perfil: ${PROFILES[main].nombre}`,
      `Primer paso: ${esc(prioridades[0] || 'Progreso, no perfección')}`,
      'Menú del día personalizado'
    ];
    view.innerHTML = `
      <h2 class="mt">Armando tu plan${nombreTxt}…</h2>
      <div class="armando-list mt">${items.map((t, i) => `<div class="armando-item" id="ap-${i}"><span class="armando-check">⏳</span><span>${t}</span></div>`).join('')}</div>`;
    container.appendChild(view);
    items.forEach((_, i) => {
      setTimeout(() => {
        const el = view.querySelector(`#ap-${i}`);
        if (el) { el.classList.add('done'); el.querySelector('.armando-check').textContent = '✓'; }
      }, 380 + i * 420);
    });
    setTimeout(onDone, 380 + items.length * 420 + 300);
  }

  function mostrarResultado(main, rest, prioridades) {
    container.innerHTML = '';
    const view = document.createElement('div');
    view.innerHTML = `
      <div class="quiz-progress"><div style="width:100%"></div></div>
      <div class="card center">
        ${rutiMascot('saludo', { size: 72 })}
        <h2 class="mt">${answers.nombre ? `${esc(answers.nombre)}, tu` : 'Tu'} plan está listo</h2>
        <p class="small mt">Perfil principal: <strong>${PROFILES[main].nombre}</strong></p>
        ${rest.length ? `<p class="mt">También te conviene seguir: <strong>${rest.map((p) => PROFILES[p].nombre).join(', ')}</strong></p>` : ''}
      </div>
      <div class="card">
        <h3>Tus primeros pasos 👣</h3>
        <ul class="steps check mt">${prioridades.map((p) => `<li>${p}</li>`).join('')}</ul>
      </div>
      <div class="legal-note">La información que diste nos ayuda a personalizar tu experiencia. Esta app es una guía de autoayuda y no reemplaza la atención de un profesional de salud.</div>
      <button class="btn full accent">Siguiente →</button>`;
    view.querySelector('.btn').addEventListener('click', () => mostrarCompromiso());
    container.appendChild(view);
  }

  // Pantalla de compromiso: elegir con cuántos días empezar, justo después
  // de ver el resultado — comprometerse activamente antes de la primera
  // acción real aumenta la motivación (mismo principio que usa Duolingo
  // con su meta de racha). Las opciones son los mismos umbrales que ya
  // usan los logros racha_3/7/30 — no un número nuevo sin respaldo.
  function mostrarCompromiso() {
    container.innerHTML = '';
    const view = document.createElement('div');
    view.className = 'quiz-step';
    const opciones = [
      { dias: 3, label: '3 días', sub: 'Para probar tu primer paso' },
      { dias: 7, label: '7 días', sub: 'Una semana completa' },
      { dias: 30, label: '30 días', sub: 'Cambiar de verdad' }
    ];
    let elegido = 7;
    view.innerHTML = `
      <div class="quiz-progress"><div style="width:100%"></div></div>
      <h2>Antes de empezar: un compromiso contigo 💛</h2>
      <p>Sé que a veces el día a día no deja espacio para pensar en ti. Pero tu cuerpo lleva la cuenta, incluso cuando tú no la llevas. Comprometerte hoy — aunque sea con un paso chiquito — no es una exigencia más: es una forma real de decirte a ti misma que mereces cuidarte con constancia.</p>
      <p class="mt" style="font-weight:600">¿Con cuántos días quieres empezar este compromiso?</p>
      <div class="chips mt" id="compromiso-chips"></div>
      <button class="btn full accent mt">Ver mi menú personalizado 🍽️</button>`;
    const chipWrap = view.querySelector('#compromiso-chips');
    for (const o of opciones) {
      const b = document.createElement('button');
      b.className = 'chip' + (o.dias === elegido ? ' selected' : '');
      b.innerHTML = `${o.label}<br><span class="small" style="font-weight:400">${o.sub}</span>`;
      b.addEventListener('click', () => {
        elegido = o.dias;
        chipWrap.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('selected', opciones[i].dias === elegido));
      });
      chipWrap.appendChild(b);
    }
    view.querySelector('.btn').addEventListener('click', () => {
      const cur = getState().user;
      setState({ user: { ...cur, compromisoDias: elegido, compromisoDesde: today() } });
      navigate('dashboard');
    });
    container.appendChild(view);
  }

  draw();
}
