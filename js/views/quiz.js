// Quiz inicial de personalización (onboarding).
import { getState, setState, esc, today } from '../store.js';
import { PROFILES, EXCLUSIONS, GOALS, HARD_HABITS } from '../data/profiles.js';
import { navigate } from '../app.js';
import { rutiMascot } from '../mascot.js';

// Respeta el modo minimalista ("Ocultar Ruti" en Ajustes) — la app sigue
// funcionando igual, solo deja de dibujarla.
function rutiSiVisible(mood, opts) {
  return getState().rutiOculto ? '' : rutiMascot(mood, opts);
}

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

const MOTIVATION = [
  { id: 'poca', nombre: 'Poco motivado/a', emoji: '😔' },
  { id: 'algo', nombre: 'Algo motivado/a', emoji: '🙂' },
  { id: 'mucha', nombre: 'Muy motivado/a', emoji: '😃' },
  { id: 'total', nombre: 'Totalmente motivado/a', emoji: '🤩' }
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
    habitosDificiles: [], motivacion: '', actividad: '', azucarFreq: '', alcoholFreq: '',
    pesoKg: known.pesoKg || ''
  };
  let step = 0;

  const steps = [
    {
      title: '¡Hola! 🌿 Empecemos con NutriRuta',
      sub: '',
      render(el) {
        // Video de bienvenida (fondo transparente, ver img/ruti/bienvenida.webm)
        // en vez de la imagen fija -- si el navegador no soporta WebM con
        // canal alfa (algo de Safari viejo), cae a la imagen estática real,
        // nunca a un cuadro roto. Bienvenida pura, sin pedir nada todavía
        // (el nombre y el aviso de privacidad viven en el siguiente paso) --
        // comparado con Duolingo/Fitia, la primera pantalla no debía pedir
        // datos antes de generar interés.
        const rutiHtml = getState().rutiOculto ? '' : `
          <video autoplay muted loop playsinline poster="./img/ruti/saludo.png" style="height:150px;width:auto;display:block;margin:0 auto" id="q-ruti-video">
            <source src="./img/ruti/bienvenida.webm" type="video/webm">
          </video>`;
        el.innerHTML = `
          <div class="center mb">${rutiHtml}</div>
          <p class="center small" style="font-weight:600">Soy Ruti. Vamos a encontrar una Ruta que funcione para ti.</p>`;
        const video = el.querySelector('#q-ruti-video');
        if (video && !video.canPlayType('video/webm; codecs="vp9"')) {
          video.outerHTML = rutiSiVisible('saludo', { size: 150 });
        } else {
          video?.addEventListener('error', () => { video.outerHTML = rutiSiVisible('saludo', { size: 150 }); });
        }
        el.querySelector('#q-ya-tengo-cuenta')?.addEventListener('click', () => navigate('auth'));
      }
    },
    {
      title: '¿Cómo te llamas?',
      sub: 'Opcional -- puedes dejarlo en blanco.',
      render(el) {
        // El aviso legal completo ya vive en Ajustes -> Legal (Términos y
        // Privacidad, ver settings.js) -- repetirlo aquí era redundante.
        el.innerHTML = `
          <input id="q-nombre" type="text" placeholder="Tu nombre o alias" maxlength="60" class="auth-input">`;
        const input = el.querySelector('#q-nombre');
        input.value = answers.nombre; // asignación por propiedad: sin riesgo de inyección HTML
        input.addEventListener('input', (e) => { answers.nombre = e.target.value.trim(); });
      }
    },
    {
      title: '¿Qué quieres lograr?',
      sub: 'Elige todo lo que aplique.',
      completo: () => answers.objetivos.length > 0,
      render: (el, onChange) => chips(el, GOALS, answers.objetivos, true, undefined, false, onChange)
    },
    {
      title: '¿Tienes alguna condición conocida?',
      sub: 'Solo si te la han mencionado en un chequeo. Puedes elegir varias.',
      completo: () => answers.condiciones.length > 0,
      render: (el, onChange) => chips(el, CONDITIONS, answers.condiciones, true, undefined, false, onChange)
    },
    {
      title: '¿Qué alimentos no consumes?',
      sub: 'Alergias, intolerancias o preferencias. Adaptaremos recetas y sustituciones. Si no tienes ninguna, solo presiona Siguiente.',
      render(el) {
        chips(el, EXCLUSIONS, answers.exclusiones, true);
        el.insertAdjacentHTML('beforeend', `
          <label class="muted small mt" for="q-excl-otro" style="display:block">¿Algo más que no comas? (opcional, separa varios con coma)</label>
          <input id="q-excl-otro" type="text" placeholder="Ej: cilantro, champiñones" maxlength="200" class="auth-input">`);
        const input = el.querySelector('#q-excl-otro');
        input.value = answers.exclusionesOtroTexto;
        input.addEventListener('input', (e) => { answers.exclusionesOtroTexto = e.target.value; });
      }
    },
    {
      title: '¿Con cuáles de estos retos te identificas?',
      sub: 'Marca lo que te pasa hoy en día. Sin culpa: nos ayuda a acompañarte mejor. Si ninguno aplica, solo presiona Siguiente.',
      render: (el) => chips(el, HARD_HABITS, answers.habitosDificiles, true, undefined, true)
    },
    {
      title: '¿Qué tan motivado/a estás para lograrlo?',
      sub: '',
      completo: () => !!answers.motivacion,
      render: (el, onChange) => chips(el, MOTIVATION, answers, false, 'motivacion', true, onChange)
    },
    {
      title: '¿Tu nivel de actividad física?',
      sub: '',
      completo: () => !!answers.actividad,
      render: (el, onChange) => chips(el, ACTIVITY, answers, false, 'actividad', true, onChange)
    },
    {
      title: '¿Cuál es tu peso? (opcional)',
      sub: 'Solo lo usamos para calcular tu meta diaria de agua, personalizada según tu cuerpo (30–35 mL por kg). Puedes dejarlo en blanco y usamos una meta general.',
      render(el) {
        el.innerHTML = `
          <div class="row" style="align-items:center;gap:10px">
            <input id="q-peso" type="number" inputmode="numeric" min="30" max="300" placeholder="Ej: 65" class="auth-input" style="width:120px;margin:0">
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
      completo: () => !!answers.azucarFreq,
      render: (el, onChange) => chips(el, FREQ_OPTIONS, answers, false, 'azucarFreq', true, onChange)
    },
    {
      title: '¿Con qué frecuencia consumes alcohol?',
      sub: 'Cerveza, vino, licores… Si no tomas, elige "Nunca".',
      completo: () => !!answers.alcoholFreq,
      render: (el, onChange) => chips(el, FREQ_OPTIONS, answers, false, 'alcoholFreq', true, onChange)
    }
  ];

  // onChange: se llama después de marcar/desmarcar una selección, para que
  // draw() pueda habilitar el botón "Siguiente" -- igual que el quiz de
  // Fitia: el botón siempre está visible, deshabilitado hasta elegir una
  // respuesta, y hay que presionarlo a propósito para avanzar (nunca
  // avanza solo).
  function chips(el, options, target, multi, prop, oneCol, onChange) {
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
        if (onChange) onChange();
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
    // El primer paso (bienvenida) es solo presentación -- no hay nada
    // "avanzado" todavía, así que no muestra la barra de progreso, y su
    // título/párrafo van centrados en vez de alineados a la izquierda
    // como el resto de las preguntas.
    view.className = 'quiz-step' + (step === 0 ? ' quiz-step-intro' : '');
    view.innerHTML = `
      ${step === 0 ? '' : `
      <div class="quiz-topbar">
        <button class="quiz-topbar-back" aria-label="Atrás"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="quiz-progress"><div style="width:${pct}%"></div></div>
      </div>`}
      <h2>${s.title}</h2>
      ${s.sub ? `<p>${s.sub}</p>` : ''}
      <div class="step-body"></div>
      <div class="quiz-nav"></div>`;
    view.querySelector('.quiz-topbar-back')?.addEventListener('click', () => { if (step > 0) { step--; draw(); } });

    // El botón SIEMPRE está visible (como en Fitia) -- nunca aparece de la
    // nada ni avanza solo. Empieza deshabilitado si el paso lo requiere
    // (s.completo) y se habilita apenas hay una respuesta válida.
    const navEl = view.querySelector('.quiz-nav');
    const next = document.createElement('button');
    next.className = 'btn full';
    next.textContent = step === 0 ? 'Empezar' : step === steps.length - 1 ? 'Ver mi resultado ✨' : 'Siguiente';
    next.disabled = s.completo ? !s.completo() : false;
    next.addEventListener('click', () => {
      if (step === steps.length - 1) result(); else { step++; draw(); }
    });
    navEl.appendChild(next);

    // "¿Ya tienes cuenta?" va DEBAJO del botón, no arriba -- solo en la
    // bienvenida (nunca se muestra si ya viene onboarded, ej. reeditando
    // respuestas desde Ajustes).
    if (step === 0 && !getState().onboarded) {
      const loginP = document.createElement('p');
      loginP.className = 'center small mt';
      loginP.innerHTML = '¿Ya tienes cuenta? <button type="button" class="link-btn" id="q-ya-tengo-cuenta">Inicia sesión</button>';
      loginP.querySelector('#q-ya-tengo-cuenta').addEventListener('click', () => navigate('auth'));
      navEl.appendChild(loginP);
    }

    s.render(view.querySelector('.step-body'), () => { next.disabled = s.completo ? !s.completo() : false; });
    container.appendChild(view);

    // El botón se alinea con el ancho real del TEXTO del título, no un
    // porcentaje fijo arbitrario -- h2 es un bloque que ocupa todo el
    // ancho disponible por defecto, así que para medir su contenido real
    // se vuelve inline-block un instante (se ajusta solo al texto, o a la
    // línea más larga si el título se parte en dos) y se revierte.
    const h2 = view.querySelector('h2');
    if (h2) {
      const prevDisplay = h2.style.display;
      h2.style.display = 'inline-block';
      next.style.width = `${Math.min(h2.offsetWidth, view.clientWidth)}px`;
      h2.style.display = prevDisplay;
    }
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
        motivacion: answers.motivacion,
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
    const total = 380 + items.length * 420 + 300;
    const RADIO = 42, CIRC = 2 * Math.PI * 42;
    view.innerHTML = `
      <h2 class="mt">Armando tu plan${nombreTxt}…</h2>
      <div class="armando-ring mt">
        <svg viewBox="0 0 96 96">
          <circle class="armando-ring-track" cx="48" cy="48" r="${RADIO}"/>
          <circle class="armando-ring-fill" cx="48" cy="48" r="${RADIO}"
            stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${CIRC.toFixed(1)}"/>
        </svg>
        <span class="armando-ring-pct" id="ap-pct">0%</span>
      </div>
      <div class="quiz-progress mt" style="max-width:280px;margin-left:auto;margin-right:auto"><div id="ap-bar" style="width:0%"></div></div>
      <div class="armando-list mt">${items.map((t, i) => `<div class="armando-item" id="ap-${i}"><span class="armando-check">⏳</span><span>${t}</span></div>`).join('')}</div>`;
    container.appendChild(view);

    // Anillo + barra reflejan el mismo avance real que el checklist de
    // abajo (mismo `total`), no una animación aparte desincronizada.
    const ringFill = view.querySelector('.armando-ring-fill');
    const pctLabel = view.querySelector('#ap-pct');
    const bar = view.querySelector('#ap-bar');
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - startedAt) / total) * 100));
      ringFill.style.strokeDashoffset = (CIRC * (1 - pct / 100)).toFixed(1);
      pctLabel.textContent = `${pct}%`;
      bar.style.width = `${pct}%`;
      if (pct >= 100) clearInterval(tick);
    }, 60);

    items.forEach((_, i) => {
      setTimeout(() => {
        const el = view.querySelector(`#ap-${i}`);
        if (el) { el.classList.add('done'); el.querySelector('.armando-check').textContent = '✓'; }
      }, 380 + i * 420);
    });
    setTimeout(onDone, total);
  }

  function mostrarResultado(main, rest, prioridades) {
    container.innerHTML = '';
    const view = document.createElement('div');
    view.innerHTML = `
      <div class="quiz-progress"><div style="width:100%"></div></div>
      <div class="card center">
        ${rutiSiVisible('saludo', { size: 100 })}
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
    // Sin preseleccionar: es un compromiso, tiene que elegirse de verdad.
    let elegido = null;
    view.innerHTML = `
      <div class="quiz-progress"><div style="width:100%"></div></div>
      <h2>Antes de empezar: un compromiso contigo 💛</h2>
      <p>Sé que a veces el día a día no deja espacio para pensar en ti. Pero tu cuerpo lleva la cuenta, incluso cuando tú no la llevas. Comprometerte hoy — aunque sea con un paso chiquito — no es una exigencia más: es una forma real de decirte a ti misma que mereces cuidarte con constancia.</p>
      <p class="mt" style="font-weight:600">¿Con cuántos días quieres empezar este compromiso?</p>
      <div class="chips chips-1col mt" id="compromiso-chips"></div>
      <button class="btn full accent mt" disabled>Ver mi menú personalizado 🍽️</button>`;
    const chipWrap = view.querySelector('#compromiso-chips');
    const continuarBtn = view.querySelector('.btn');
    for (const o of opciones) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.innerHTML = `<span>${o.label}<br><span class="small" style="font-weight:400">${o.sub}</span></span>`;
      b.addEventListener('click', () => {
        elegido = o.dias;
        continuarBtn.disabled = false;
        chipWrap.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('selected', opciones[i].dias === elegido));
      });
      chipWrap.appendChild(b);
    }
    continuarBtn.addEventListener('click', () => {
      const cur = getState().user;
      setState({ user: { ...cur, compromisoDias: elegido, compromisoDesde: today() } });
      // Todavía no hay cuenta en este punto (login-después-del-quiz): si
      // navigate() redirige a 'auth' por no estar autenticada, debe abrir
      // en modo registro, no en login -- confundía a quien recién terminó
      // el quiz y se topaba con una pantalla de "Inicia sesión". Si ya
      // hubiera sesión (ej. rehaciendo el quiz desde Ajustes), este mode
      // simplemente no se usa y va directo al dashboard.
      navigate('dashboard', { mode: 'signup' });
    });
    container.appendChild(view);
  }

  draw();
}
