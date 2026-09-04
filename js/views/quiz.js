// Quiz inicial de personalización (onboarding).
import { getState, setState, esc, today } from '../store.js';
import { PROFILES, EXCLUSIONS, GOALS, HARD_HABITS } from '../data/profiles.js';
import { navigate, openModal } from '../app.js';
import { rutiMascot } from '../mascot.js';

// Respeta el modo minimalista ("Ocultar Ruti" en Ajustes) — la app sigue
// funcionando igual, solo deja de dibujarla.
function rutiSiVisible(mood, opts) {
  return getState().rutiOculto ? '' : rutiMascot(mood, opts);
}

// Video de bienvenida (fondo transparente, ver img/ruti/bienvenida.webm)
// -- se reutiliza en la bienvenida del quiz Y en "Armando tu plan" (la
// usuaria pidió la misma animación en ambas). Si el navegador no soporta
// WebM con canal alfa o el video falla, cae a la imagen estática real.
function rutiBienvenidaHtml(size) {
  return getState().rutiOculto ? '' : `
    <video autoplay muted loop playsinline poster="./img/ruti/saludo.png" style="height:${size}px;width:auto;display:block;margin:0 auto" class="q-ruti-video">
      <source src="./img/ruti/bienvenida.webm" type="video/webm">
    </video>`;
}
function iniciarRutiBienvenida(el, size) {
  const video = el.querySelector('.q-ruti-video');
  if (!video) return;
  if (!video.canPlayType('video/webm; codecs="vp9"')) {
    video.outerHTML = rutiSiVisible('saludo', { size });
  } else {
    video.addEventListener('error', () => { video.outerHTML = rutiSiVisible('saludo', { size }); });
  }
}

// Estallido de confeti sobre toda la pantalla (ej. al terminar de armar
// el plan) -- solo papelitos de colores cayendo, nada de emoji. Se
// dibuja en un overlay fixed aparte (no dentro del contenedor del
// quiz), así sigue viéndose completo aunque la pantalla debajo cambie
// o navegue antes de que termine de caer. Respeta "reducir movimiento".
const CONFETI_COLORES = ['#2BB5A0', '#7CC96A', '#FFC94A', '#FF7A5C', '#5AA9E6'];
function lanzarConfeti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const capa = document.createElement('div');
  capa.className = 'confeti-capa';
  const N = 90;
  for (let i = 0; i < N; i++) {
    const p = document.createElement('span');
    p.className = 'confeti-pieza';
    const izquierda = Math.random() * 100;
    const retraso = Math.random() * 0.4;
    const duracion = 2.2 + Math.random() * 1.3;
    const giro = Math.random() * 360;
    const color = CONFETI_COLORES[i % CONFETI_COLORES.length];
    const ancho = 6 + Math.random() * 5;
    p.style.cssText = `left:${izquierda}%; --duracion:${duracion}s; animation-delay:${retraso}s; background:${color}; width:${ancho}px; height:${ancho * 0.4}px; transform:rotate(${giro}deg);`;
    capa.appendChild(p);
  }
  document.body.appendChild(capa);
  setTimeout(() => capa.remove(), 4000);
}

// Logos reales (no emoji genérico) para las redes que sí tienen un ícono
// reconocible -- la usuaria lo pidió explícitamente para Instagram,
// Facebook, YouTube y TikTok. SVG a mano con los colores de marca (sin
// depender de una librería de íconos externa, coherente con el resto de
// la app que no carga assets de terceros).
const LOGO_INSTAGRAM = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <defs><linearGradient id="ig-g" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0%" stop-color="#FFDD55"/><stop offset="45%" stop-color="#E64A63"/><stop offset="100%" stop-color="#C837AB"/>
  </linearGradient></defs>
  <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="url(#ig-g)" stroke-width="2"/>
  <circle cx="12" cy="12" r="4.6" fill="none" stroke="url(#ig-g)" stroke-width="2"/>
  <circle cx="17.6" cy="6.4" r="1.3" fill="url(#ig-g)"/>
</svg>`;
const LOGO_FACEBOOK = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <circle cx="12" cy="12" r="10.5" fill="#1877F2"/>
  <path d="M15.1 12.6h-2.2V20h-3v-7.4H8.3v-2.6h1.6V8.4c0-1.6.9-3 3.4-3h2v2.5h-1.4c-.4 0-.7.2-.7.8v1.3h2.2z" fill="#fff"/>
</svg>`;
const LOGO_YOUTUBE = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <rect x="1.5" y="5" width="21" height="14" rx="4.5" fill="#FF0000"/>
  <path d="M10 8.6l6 3.4-6 3.4z" fill="#fff"/>
</svg>`;
const LOGO_TIKTOK = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <path d="M15.6 3h2.5c.2 1.6 1.4 3 3 3.3v2.5c-1.1 0-2.2-.4-3-1v6.6c0 3-2.4 5.4-5.4 5.4S7.3 17.4 7.3 14.4c0-2.9 2.2-5.2 5-5.4v2.6a2.8 2.8 0 1 0 2.8 2.8V3z" fill="#25F4EE"/>
  <path d="M14.9 3h2.5c.2 1.6 1.4 3 3 3.3v2.5c-1.1 0-2.2-.4-3-1v6.6c0 3-2.4 5.4-5.4 5.4S6.6 17.4 6.6 14.4c0-2.9 2.2-5.2 5-5.4v2.6a2.8 2.8 0 1 0 2.8 2.8V3z" fill="#FE2C55" opacity="0.75"/>
  <path d="M15.25 3h2.5c.2 1.6 1.4 3 3 3.3v2.5c-1.1 0-2.2-.4-3-1v6.6c0 3-2.4 5.4-5.4 5.4s-5.4-2.4-5.4-5.4c0-2.9 2.2-5.2 5-5.4v2.6a2.8 2.8 0 1 0 2.8 2.8V3z" fill="#fff" opacity="0.9"/>
</svg>`;

const ORIGEN = [
  { id: 'instagram', nombre: 'Instagram', iconoHtml: LOGO_INSTAGRAM },
  { id: 'tiktok', nombre: 'TikTok', iconoHtml: LOGO_TIKTOK },
  { id: 'facebook', nombre: 'Facebook', iconoHtml: LOGO_FACEBOOK },
  { id: 'youtube', nombre: 'YouTube', iconoHtml: LOGO_YOUTUBE },
  { id: 'amigo', nombre: 'Un amigo o familiar', emoji: '👋' },
  { id: 'referido', nombre: 'Fui referido/a', emoji: '🎁' },
  { id: 'busqueda', nombre: 'Buscando en internet', emoji: '🔍' },
  { id: 'anuncio', nombre: 'Un anuncio publicitario', emoji: '📣' },
  { id: 'otro', nombre: 'Otro', emoji: '✨' }
];

const CONDITIONS = [
  { id: 'higado_graso', nombre: 'Hígado graso', emoji: '🫀' },
  { id: 'resistencia_insulina', nombre: 'Resistencia a la insulina', emoji: '🩸' },
  { id: 'prediabetes', nombre: 'Prediabetes', emoji: '🛡️' },
  { id: 'colesterol', nombre: 'Colesterol alto', emoji: '❤️' },
  { id: 'colon_irritable', nombre: 'Colon irritable', emoji: '🌱' },
  { id: 'gases', nombre: 'Gases', emoji: '🎈' },
  { id: 'hinchazon', nombre: 'Hinchazón frecuente', emoji: '🎈' },
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
    else if (c === 'hinchazon') p.add('gases'); // mismo perfil dietético que "Gases", solo se separó la opción del quiz para que el texto fuera más corto
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
    nombre: known.nombre || '', objetivos: [], objetivosOtro: [], condiciones: [], exclusiones: [], exclusionesOtro: [], origen: '', origenOtroTexto: '',
    // Sin valor por defecto: ninguna opción debe verse preseleccionada,
    // la usuaria elige de verdad cada respuesta.
    habitosDificiles: [], motivacion: '', actividad: '', azucarFreq: '', alcoholFreq: '',
    pesoKg: known.pesoKg || '', sexo: known.sexo || '', edad: known.edad || '', estaturaCm: known.estaturaCm || ''
  };
  let step = 0;

  const steps = [
    {
      title: '¡Hola! 🌿 Empecemos con NutriRuta',
      sub: '',
      render(el) {
        // Bienvenida pura, sin pedir nada todavía (el nombre y el aviso de
        // privacidad viven en el siguiente paso) -- comparado con
        // Duolingo/Fitia, la primera pantalla no debía pedir datos antes
        // de generar interés.
        // El logo+nombre va arriba del todo, ANTES que el título -- el
        // título (h2) sigue igual, no se toca -- el logo+nombre se agrega
        // en draw() ANTES del h2, solo para este paso (ver más abajo).
        el.innerHTML = `
          <div class="center"><div class="ruti-bubble">Soy Ruti. Vamos a encontrar una Ruta que funcione para ti.</div></div>
          <div class="center mb">${rutiBienvenidaHtml(150)}</div>`;
        iniciarRutiBienvenida(el, 150);
        el.querySelector('#q-ya-tengo-cuenta')?.addEventListener('click', () => navigate('auth'));
      }
    },
    {
      title: '¿Cómo te llamas?',
      sub: '',
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
      title: '¿Cómo te enteraste de NutriRuta?',
      sub: '',
      completo: () => !!answers.origen,
      render(el, onChange) {
        chips(el, ORIGEN, answers, false, 'origen', true, () => {
          pintarOrigenOtro(el);
          onChange();
        });
        const otroBox = document.createElement('div');
        otroBox.className = 'mt';
        otroBox.id = 'q-origen-otro-box';
        el.appendChild(otroBox);
        pintarOrigenOtro(el);
      }
    },
    {
      title: '¿Qué quieres lograr?',
      sub: 'Elige todo lo que aplique.',
      completo: () => answers.objetivos.length > 0 || answers.objetivosOtro.length > 0,
      render: (el, onChange) => renderChipsConOtro(el, GOALS, answers.objetivos, answers.objetivosOtro, {
        titulo: 'Agrega una meta propia', placeholder: 'Ej. Dormir mejor, tener más disciplina...'
      }, onChange)
    },
    {
      title: '¿Tienes alguna condición conocida?',
      sub: 'Solo si te la han mencionado en un chequeo. Puedes elegir varias.',
      completo: () => answers.condiciones.length > 0,
      render: (el, onChange) => chips(el, CONDITIONS, answers.condiciones, true, undefined, false, onChange)
    },
    {
      title: '¿Qué alimentos no consumes?',
      sub: 'Alergias, intolerancias o preferencias. Adaptaremos recetas y sustituciones.',
      completo: () => answers.exclusiones.length > 0 || answers.exclusionesOtro.length > 0,
      render: (el, onChange) => renderChipsConOtro(el, EXCLUSIONS, answers.exclusiones, answers.exclusionesOtro, {
        titulo: 'Agrega una alergia o intolerancia', placeholder: 'Ej. Cilantro, champiñones...'
      }, onChange)
    },
    {
      title: '¿Con cuáles de estos retos te identificas?',
      sub: 'Marca lo que te pasa hoy en día. Sin culpa: nos ayuda a acompañarte mejor.',
      completo: () => answers.habitosDificiles.length > 0,
      render: (el, onChange) => chips(el, HARD_HABITS, answers.habitosDificiles, true, undefined, true, onChange)
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
      // Como en Fitia ("Sobre ti"), pero con un uso real y distinto al de
      // ellos: Fitia lo pide para calcular calorías -- NutriRuta decidió a
      // propósito NO ser un contador de calorías. Aquí sexo+peso afinan la
      // meta de agua (ver getWaterGoal en store.js, mismo rango clínico de
      // siempre, solo mejor ajustado). Edad y estatura no alimentan ningún
      // cálculo todavía -- se guardan para SuSana y usos futuros, nunca
      // inventados como si ya hicieran algo que no hacen.
      title: 'Sobre ti (opcional)',
      sub: 'Con esto afinamos tu meta diaria de agua. Puedes dejar cualquier campo en blanco.',
      // Misma estructura de fila (ícono + etiqueta + valor + flecha) que ya
      // usa Ajustes para Tema/Idioma/Unidades (.setting-row), en vez de
      // campos de texto sueltos -- toca la fila, se abre un selector chico,
      // igual al patrón real de "Sobre ti" en Fitia (una fila por dato,
      // "Seleccionar" hasta que se elige, luego muestra el valor).
      render(el) {
        el.innerHTML = `
          <div id="sobre-ti-filas"></div>
          <div class="legal-note">🔒 Es privado, nadie más lo ve, y puedes borrarlo cuando quieras desde Ajustes.</div>`;
        pintarSobreTiFilas(el.querySelector('#sobre-ti-filas'));
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

  // Textbox que aparece solo cuando se elige "Otro" en el origen -- se
  // repinta después de cada cambio de chip para mostrarlo/ocultarlo.
  function pintarOrigenOtro(el) {
    const box = el.querySelector('#q-origen-otro-box');
    if (!box) return;
    box.innerHTML = answers.origen === 'otro'
      ? '<input type="text" id="q-origen-otro-input" placeholder="Cuéntanos dónde" maxlength="80" class="auth-input">'
      : '';
    const input = box.querySelector('#q-origen-otro-input');
    if (input) {
      input.value = answers.origenOtroTexto;
      input.addEventListener('input', (e) => { answers.origenOtroTexto = e.target.value; });
    }
  }

  // Filas de "Sobre ti": ícono + etiqueta + valor actual ("Seleccionar"
  // si aún no se eligió) + flecha -- se repinta después de cada cambio,
  // igual que el resto de los "pintar*" de este archivo.
  const SOBRE_TI_CAMPOS = [
    { key: 'sexo', icono: '👤', label: 'Sexo' },
    { key: 'edad', icono: '🎂', label: 'Edad', sufijo: ' años' },
    { key: 'estaturaCm', icono: '📏', label: 'Estatura', sufijo: ' cm' },
    { key: 'pesoKg', icono: '⚖️', label: 'Peso', sufijo: ' kg' }
  ];
  function pintarSobreTiFilas(el) {
    el.innerHTML = SOBRE_TI_CAMPOS.map((c) => {
      const valor = answers[c.key];
      const texto = valor
        ? (c.key === 'sexo' ? (valor === 'mujer' ? 'Mujer' : 'Hombre') : `${valor}${c.sufijo}`)
        : 'Seleccionar';
      return `
        <button type="button" class="setting-row" data-campo="${c.key}">
          <span class="setting-row-icon">${c.icono}</span>
          <span class="setting-row-label">${c.label}</span>
          <span class="setting-row-value" style="${valor ? '' : 'color:var(--primary)'}">${texto}</span>
          <span class="setting-row-chevron">›</span>
        </button>`;
    }).join('');
    el.querySelectorAll('.setting-row').forEach((row) => {
      row.addEventListener('click', () => abrirSobreTiCampo(row.dataset.campo, el));
    });
  }

  function abrirSobreTiCampo(campo, el) {
    if (campo === 'sexo') {
      openModal((modal, closeFn) => {
        modal.insertAdjacentHTML('beforeend', '<h2>Sexo</h2><div class="mt" id="sexo-opciones"></div>');
        const cont = modal.querySelector('#sexo-opciones');
        for (const op of [{ id: 'mujer', label: 'Mujer' }, { id: 'hombre', label: 'Hombre' }]) {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'habit selector-opcion' + (op.id === answers.sexo ? ' selected' : '');
          row.innerHTML = `<label>${op.label}</label>${op.id === answers.sexo ? '<span>✓</span>' : ''}`;
          row.addEventListener('click', () => {
            answers.sexo = answers.sexo === op.id ? '' : op.id;
            closeFn();
            pintarSobreTiFilas(el);
          });
          cont.appendChild(row);
        }
      });
      return;
    }
    abrirRuletaNumero(campo, el);
  }

  // Selector tipo ruleta (scroll-snap nativo) para Edad/Estatura/Peso --
  // el mismo gesto de "deslizar y el número del centro queda elegido"
  // que usa Fitia para estos mismos 3 campos, en vez de un input de
  // texto suelto. Peso admite kg/lbs (se guarda siempre en kg, que es
  // lo que usa el resto de la app -- ver getWaterGoal en store.js).
  const RULETA_ALTO = 44;
  function abrirRuletaNumero(campo, el) {
    const config = {
      edad: { titulo: 'Edad', min: 13, max: 110, sufijo: 'años', unidades: null },
      estaturaCm: { titulo: 'Estatura', min: 120, max: 230, sufijo: 'cm', unidades: null },
      pesoKg: { titulo: 'Peso', min: 30, max: 300, sufijo: 'kg', unidades: ['kg', 'lbs'] }
    }[campo];
    const KG_A_LBS = 2.20462;

    openModal((modal, closeFn) => {
      let unidad = config.unidades ? config.unidades[0] : null;
      let valorEnPantalla = null; // en la unidad que se está mostrando ahora mismo

      modal.insertAdjacentHTML('beforeend', `
        <h2 class="center">${config.titulo}</h2>
        ${config.unidades ? `
        <div class="ruleta-unidades">
          ${config.unidades.map((u, i) => `<button type="button" class="chip${i === 0 ? ' selected' : ''}" data-unidad="${u}">${u}</button>`).join('')}
        </div>` : ''}
        <div class="ruleta-wrap">
          <div class="ruleta-resalto"></div>
          <div class="ruleta-scroll" id="ruleta-scroll"></div>
        </div>
        <button type="button" class="btn full mt" id="ruleta-guardar">Guardar</button>`);

      const scrollEl = modal.querySelector('#ruleta-scroll');

      const aUnidad = (kg, u) => u === 'lbs' ? Math.round(kg * KG_A_LBS) : Math.round(kg);
      const aKg = (v, u) => u === 'lbs' ? Math.round(v / KG_A_LBS) : Math.round(v);
      const rango = () => config.unidades && unidad === 'lbs'
        ? { min: Math.round(config.min * KG_A_LBS), max: Math.round(config.max * KG_A_LBS) }
        : { min: config.min, max: config.max };

      function pintarItems() {
        const { min, max } = rango();
        let html = '<div class="ruleta-pad"></div>';
        for (let v = min; v <= max; v++) html += `<div class="ruleta-item" data-val="${v}">${v}</div>`;
        html += '<div class="ruleta-pad"></div>';
        scrollEl.innerHTML = html;
      }

      function marcarCentro() {
        const { min } = rango();
        const idx = Math.round(scrollEl.scrollTop / RULETA_ALTO);
        scrollEl.querySelectorAll('.ruleta-item').forEach((it, i) => {
          const centro = i === idx;
          it.classList.toggle('centrado', centro);
          it.innerHTML = centro ? `${it.dataset.val}<span class="ruleta-sufijo">${unidad || config.sufijo}</span>` : it.dataset.val;
        });
        valorEnPantalla = min + idx;
      }

      function irA(valor) {
        const { min } = rango();
        scrollEl.scrollTop = (valor - min) * RULETA_ALTO;
        marcarCentro();
      }

      let scrollTimer;
      scrollEl.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(marcarCentro, 60);
      });

      pintarItems();
      const inicial = answers[campo]
        ? (config.unidades ? aUnidad(Number(answers[campo]), unidad) : Number(answers[campo]))
        : Math.round((config.min + config.max) / 2);
      // El scroll inicial se difiere un frame: justo al insertar el HTML
      // el navegador todavía no terminó de calcular el layout (scrollHeight
      // sigue en 0), así que un scrollTop asignado en el mismo tick se
      // ignora silenciosamente y siempre arranca en el primer ítem.
      requestAnimationFrame(() => irA(inicial));

      if (config.unidades) {
        modal.querySelectorAll('.ruleta-unidades .chip').forEach((b) => {
          b.addEventListener('click', () => {
            if (b.dataset.unidad === unidad) return;
            const valorKgActual = aKg(valorEnPantalla, unidad);
            unidad = b.dataset.unidad;
            modal.querySelectorAll('.ruleta-unidades .chip').forEach((c) => c.classList.toggle('selected', c === b));
            pintarItems();
            irA(aUnidad(valorKgActual, unidad));
          });
        });
      }

      modal.querySelector('#ruleta-guardar').addEventListener('click', () => {
        answers[campo] = config.unidades ? aKg(valorEnPantalla, unidad) : valorEnPantalla;
        closeFn();
        pintarSobreTiFilas(el);
      });
    });
  }

  // "¿Qué quieres lograr?": las metas predefinidas (GOALS) y las que la
  // usuaria escribe a mano (objetivosOtro) comparten UNA sola grilla de
  // 2 columnas -- si estuvieran en dos grillas separadas, cada una
  // centraría su propio último ítem si le tocaba número impar, y se veía
  // un salto raro (ej. "Menos ansiedad por comida" sola y centrada,
  // aunque justo debajo ya seguían dos tags en columnas). Con una sola
  // grilla, el checkerboard de columnas continúa sin cortes y solo se
  // centra el último de verdad, cuando el total combinado es impar.
  // Genérico -- lo usan tanto "¿Qué quieres lograr?" (GOALS) como
  // "¿Qué alimentos no consumes?" (EXCLUSIONS), cualquier pregunta de
  // opciones múltiples que también tenga un bloque de "+ Agregar otro".
  function renderChipsConOtro(el, options, target, otroArr, textos, onChange) {
    el.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'chips';
    el.appendChild(wrap);
    chips(el, options, target, true, undefined, false, onChange, wrap);
    pintarOtroTags(el, otroArr, textos, onChange,
      () => renderChipsConOtro(el, options, target, otroArr, textos, onChange), wrap);
  }

  // "+ Agregar otro" + modal con Enter/coma para ir agregando etiquetas,
  // igual al patrón que la usuaria mostró de Fitia (minuto 7 del video
  // original): un chip abre un modal con un campo de texto, cada Enter
  // (o coma) agrega lo escrito como una etiqueta propia y limpia el
  // campo para seguir escribiendo, sin cerrar el modal. "Listo" cierra.
  const ICONO_QUITAR = `<svg class="chip-tag-quitar" viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
    <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;

  // Genérico: usado tanto por exclusiones (alergias/intolerancias) como
  // por objetivos ("¿Qué quieres lograr?") -- misma UI de tags + botón
  // "+ Agregar otro" que abre un modal, solo cambia el array que se
  // edita y los textos mostrados.
  // repintar: función a usar para redibujar todo tras agregar/quitar un
  // tag -- por defecto se re-llama a sí misma, pero cuando estas tags
  // comparten grilla con otras opciones (ver renderGoalsConOtro) el
  // llamador pasa su propio repintado completo, para no perder esas
  // otras opciones al volver a pintar.
  // sharedWrap: grilla ya existente donde appendear los tags (en vez de
  // crear una propia) -- ver chips() arriba, mismo propósito.
  function pintarOtroTags(el, arr, textos, onChange, repintar, sharedWrap) {
    const rep = repintar || (() => pintarOtroTags(el, arr, textos, onChange, repintar, sharedWrap));
    if (!sharedWrap) el.innerHTML = '';
    // El botón "+ Agregar otro" vive DENTRO de la misma grilla de 2
    // columnas que las etiquetas (no como bloque aparte abajo) -- así
    // cuenta como una opción más para la regla de abajo: si el total
    // (predefinidas + escritas a mano + este botón) es impar, la última
    // queda centrada sola; si es par, siempre en 2 columnas parejas.
    const wrap = sharedWrap || document.createElement('div');
    if (!sharedWrap) { wrap.className = 'chips'; wrap.style.marginTop = '0'; }
    arr.forEach((texto, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip selected';
      b.innerHTML = `<span class="chip-tag-texto">${esc(texto)}</span>${ICONO_QUITAR}`;
      b.setAttribute('aria-label', `Quitar ${texto}`);
      b.addEventListener('click', () => {
        arr.splice(i, 1);
        rep();
        if (onChange) onChange();
      });
      wrap.appendChild(b);
    });
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'chip';
    addBtn.textContent = '+ Agregar otro';
    addBtn.addEventListener('click', () => abrirModalOtro(el, arr, textos, onChange, rep));
    wrap.appendChild(addBtn);
    if (!sharedWrap) el.appendChild(wrap);
  }

  function abrirModalOtro(el, arr, textos, onChange, repintar) {
    openModal((modal, closeFn) => {
      modal.insertAdjacentHTML('beforeend', `
        <h2>${textos.titulo}</h2>
        <p class="small muted mb">Escribe y presiona Enter (o coma) para agregar</p>
        <input type="text" id="q-otro-nueva" placeholder="${textos.placeholder}" maxlength="40" class="auth-input">
        <div class="chips chips-1col mt" id="q-otro-nueva-tags"></div>
        <button type="button" class="btn full mt" id="q-otro-listo">Listo</button>`);
      const input = modal.querySelector('#q-otro-nueva');
      const tagsBox = modal.querySelector('#q-otro-nueva-tags');
      function pintarTags() {
        tagsBox.innerHTML = arr.map((texto, i) => `
          <button type="button" class="chip selected" data-i="${i}"><span class="chip-tag-texto">${esc(texto)}</span>${ICONO_QUITAR}</button>`).join('');
        tagsBox.querySelectorAll('.chip').forEach((b) => {
          b.addEventListener('click', () => {
            arr.splice(Number(b.dataset.i), 1);
            pintarTags();
          });
        });
      }
      // Primera letra mayúscula, el resto en minúscula -- sin importar
      // cómo lo haya escrito la usuaria (todo mayúsculas, todo
      // minúsculas, mezclado, o como lo autocorrija/autocapitalice su
      // teclado), se ve igual de prolijo que el resto de las opciones
      // predefinidas ("Pescado", "Gluten"...).
      function capitalizar(texto) {
        return texto ? texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase() : texto;
      }
      function agregar(textoForzado) {
        const texto = capitalizar((textoForzado ?? input.value).trim().replace(/,$/, '').trim());
        if (texto && !arr.includes(texto)) arr.push(texto);
        pintarTags();
      }
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); agregar(); input.value = ''; }
      });
      // La coma se detecta con 'input' (no 'keydown') a propósito: en
      // varios teclados móviles (Android/iOS con predicción de texto) el
      // evento keydown para signos de puntuación no siempre reporta la
      // tecla real -- 'input' sí refleja el valor real sin importar el
      // método de entrada (teclado físico, virtual, autocompletado,
      // pegar). Si se pega "a,b,c" de una vez, agrega "a" y "b" y deja
      // "c" lista para seguir escribiendo, en vez de perder el resto.
      input.addEventListener('input', () => {
        // Capitaliza EN VIVO mientras se escribe -- no solo al agregar
        // el tag -- para que se vea igual sin importar si el teclado del
        // celular tiene la mayúscula automática activada/desactivada.
        // Reposiciona el cursor porque reasignar .value lo manda al
        // final por defecto.
        const cursor = input.selectionStart;
        const capitalizado = capitalizar(input.value);
        if (capitalizado !== input.value) {
          input.value = capitalizado;
          input.setSelectionRange(cursor, cursor);
        }
        if (!input.value.includes(',')) return;
        const partes = input.value.split(',');
        const resto = partes.pop();
        partes.forEach((p) => agregar(p));
        input.value = resto;
      });
      modal.querySelector('#q-otro-listo').addEventListener('click', () => {
        if (input.value.trim()) agregar();
        closeFn();
        (repintar || (() => pintarOtroTags(el, arr, textos, onChange)))();
        if (onChange) onChange();
      });
      pintarTags();
      input.focus();
    });
  }

  // onChange: se llama después de marcar/desmarcar una selección, para que
  // draw() pueda habilitar el botón "Siguiente" -- igual que el quiz de
  // Fitia: el botón siempre está visible, deshabilitado hasta elegir una
  // respuesta, y hay que presionarlo a propósito para avanzar (nunca
  // avanza solo).
  // sharedWrap: para preguntas donde estas opciones comparten UNA sola
  // grilla de 2 columnas con un bloque de tags "+ Agregar otro" de abajo
  // (ver renderGoalsConOtro) -- si cada bloque tuviera su propia grilla,
  // cada una centraría su propio último ítem si le tocaba número impar,
  // y se veía un salto raro (un ítem centrado solo, con más opciones en
  // columnas justo debajo). Con una grilla compartida el checkerboard de
  // columnas no se corta, y solo se centra el último de verdad cuando el
  // total combinado (predefinidas + escritas a mano) es impar.
  function chips(el, options, target, multi, prop, oneCol, onChange, sharedWrap) {
    const wrap = sharedWrap || document.createElement('div');
    if (!sharedWrap) wrap.className = 'chips' + (oneCol ? ' chips-1col' : '');
    // Los botones de ESTAS opciones, en el mismo orden que `options` --
    // no se buscan por índice en wrap.querySelectorAll('.chip') porque
    // wrap puede tener también tags de otra fuente (ver sharedWrap) que
    // no corresponden 1 a 1 con `options`.
    const chipEls = [];
    for (const opt of options) {
      const b = document.createElement('button');
      b.className = 'chip';
      // iconoHtml: logo real de marca (SVG, ver LOGO_* arriba) para las
      // pocas opciones que lo tienen -- el resto sigue usando emoji.
      const iconoPrefijo = opt.iconoHtml || (opt.emoji ? `${opt.emoji} ` : '');
      b.innerHTML = `${iconoPrefijo}${esc(opt.nombre)}`;
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
          chipEls.forEach((c, k) => c.classList.toggle('selected', target.includes(options[k].id)));
        } else {
          // Tocar la misma opción ya elegida la deselecciona (vuelve a
          // quedar sin responder) en vez de quedar "atascada" sin forma
          // de quitarla -- pedido explícito de la usuaria.
          target[prop] = target[prop] === opt.id ? '' : opt.id;
          chipEls.forEach((c, k) => c.classList.toggle('selected', options[k].id === target[prop]));
        }
        if (onChange) onChange();
      });
      chipEls.push(b);
      wrap.appendChild(b);
    }
    if (!sharedWrap) el.appendChild(wrap);
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
      ${step === 0 ? `
      <div class="quiz-topbar quiz-topbar-brand">
        <img src="./icons/icon.svg" alt="" width="24" height="24">
        <span style="font-weight:800;font-size:1.02rem">NutriRuta</span>
      </div>` : `
      <div class="quiz-topbar">
        <button class="quiz-topbar-back" aria-label="Atrás"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="quiz-progress"><div style="width:${pct}%"></div></div>
      </div>`}
      <div class="quiz-content">
        <h2>${s.title}</h2>
        ${s.sub ? `<p>${s.sub}</p>` : ''}
        <div class="step-body"></div>
      </div>
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
  }

  function result() {
    const perfiles = deriveProfiles(answers);
    const pesoValido = Number(answers.pesoKg);
    setState({
      onboarded: true,
      user: {
        nombre: answers.nombre,
        objetivos: answers.objetivos,
        objetivosOtro: answers.objetivosOtro.slice(0, 10),
        perfiles,
        exclusiones: answers.exclusiones.filter((x) => x !== 'ninguna'),
        exclusionesOtro: answers.exclusionesOtro.slice(0, 10),
        habitosDificiles: answers.habitosDificiles.filter((x) => x !== 'ninguna'),
        motivacion: answers.motivacion,
        actividad: answers.actividad,
        azucarFreq: answers.azucarFreq,
        alcoholFreq: answers.alcoholFreq,
        origen: answers.origen,
        origenOtroTexto: answers.origen === 'otro' ? answers.origenOtroTexto.trim().slice(0, 80) : '',
        pesoKg: pesoValido >= 30 && pesoValido <= 300 ? pesoValido : null,
        sexo: answers.sexo || null,
        edad: Number(answers.edad) >= 13 && Number(answers.edad) <= 110 ? Number(answers.edad) : null,
        estaturaCm: Number(answers.estaturaCm) >= 120 && Number(answers.estaturaCm) <= 230 ? Number(answers.estaturaCm) : null,
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
    // Lista real de lo que de verdad se calculó arriba -- nada inventado,
    // solo se desglosa cada prioridad real como su propio ítem (en vez de
    // mostrar solo la primera) y se suman las demás partes reales del
    // plan, para que la lista sea más larga y el ritmo se sienta menos
    // apurado (pedido explícito de la usuaria).
    const items = [
      `Perfil: ${PROFILES[main].nombre}`,
      ...prioridades.map((p) => `Prioridad: ${esc(p)}`),
      'Menú del día personalizado',
      'Lista de compras automática',
      'Recetario adaptado a ti'
    ];
    const total = 500 + items.length * 550 + 300;
    const RADIO = 42, CIRC = 2 * Math.PI * 42;
    // El contenido va dentro de .step-body (mismo scroll interno que usa
    // el resto del quiz) -- sin esto, con una lista larga de prioridades
    // el checklist se salía del viewport y quedaba cortado abajo, sin
    // forma de verlo completo (el contenedor #app.quiz-active tiene
    // overflow:hidden). No cambia ningún estilo/tamaño, solo permite
    // scroll cuando el contenido no cabe entero.
    view.innerHTML = `
      <div class="step-body center">
        <div class="center mb">${rutiBienvenidaHtml(90)}</div>
        <h2 class="mt">Armando tu plan${nombreTxt}…</h2>
        <div class="armando-ring mt">
          <svg viewBox="0 0 96 96">
            <circle class="armando-ring-track" cx="48" cy="48" r="${RADIO}"/>
            <circle class="armando-ring-fill" cx="48" cy="48" r="${RADIO}"
              stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${CIRC.toFixed(1)}"/>
          </svg>
          <span class="armando-ring-pct" id="ap-pct">0%</span>
        </div>
        <div class="armando-list mt">${items.map((t, i) => `<div class="armando-item" id="ap-${i}"><span class="armando-check">⏳</span><span>${t}</span></div>`).join('')}</div>
      </div>`;
    container.appendChild(view);
    iniciarRutiBienvenida(view, 90);

    // El anillo refleja el mismo avance real que el checklist de abajo
    // (mismo `total`), no una animación aparte desincronizada. Ya no hay
    // una segunda barra lineal debajo -- era redundante con el anillo.
    const ringFill = view.querySelector('.armando-ring-fill');
    const pctLabel = view.querySelector('#ap-pct');
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - startedAt) / total) * 100));
      ringFill.style.strokeDashoffset = (CIRC * (1 - pct / 100)).toFixed(1);
      pctLabel.textContent = `${pct}%`;
      if (pct >= 100) clearInterval(tick);
    }, 60);

    items.forEach((_, i) => {
      setTimeout(() => {
        const el = view.querySelector(`#ap-${i}`);
        if (el) { el.classList.add('done'); el.querySelector('.armando-check').textContent = '✓'; }
        // Al chulear la última, un estallido de confeti sobre toda la
        // pantalla -- solo papelitos de colores, sin emoji de fiesta.
        if (i === items.length - 1) lanzarConfeti();
      }, 500 + i * 550);
    });
    setTimeout(onDone, total);
  }

  function mostrarResultado(main, rest, prioridades) {
    container.innerHTML = '';
    const view = document.createElement('div');
    view.className = 'quiz-step';
    // Misma estructura que el resto del quiz (quiz-content con scroll +
    // quiz-nav fijo abajo) para que el botón quede pegado abajo igual
    // que en las demás pantallas, y la misma animación de Ruti que la
    // bienvenida (no la imagen estática suelta).
    view.innerHTML = `
      <div class="quiz-content">
        <div class="step-body">
          <div class="card center">
            ${rutiBienvenidaHtml(100)}
            <h2 class="mt">${answers.nombre ? `${esc(answers.nombre)}, tu` : 'Tu'} plan está listo</h2>
            <p class="small mt">Perfil principal: <strong>${PROFILES[main].nombre}</strong></p>
            ${rest.length ? `<p class="mt">También te conviene seguir: <strong>${rest.map((p) => PROFILES[p].nombre).join(', ')}</strong></p>` : ''}
          </div>
          <div class="card">
            <h3>Tus primeros pasos 👣</h3>
            <ul class="steps check mt">${prioridades.map((p) => `<li>${p}</li>`).join('')}</ul>
          </div>
          <div class="legal-note">La información que diste nos ayuda a personalizar tu experiencia. Esta app es una guía de autoayuda y no reemplaza la atención de un profesional de salud.</div>
        </div>
      </div>
      <div class="quiz-nav"><button class="btn accent">Siguiente →</button></div>`;
    iniciarRutiBienvenida(view, 100);
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
    // Ya no hay barra de progreso -- el quiz de preguntas terminó, esto es
    // una pantalla de cierre, no un paso más. El botón queda fijo abajo
    // igual que el resto (quiz-content + quiz-nav, misma estructura que
    // usa draw() para el resto de pantallas del quiz).
    let elegido = null;
    view.innerHTML = `
      <div class="quiz-content">
        <h2>Antes de empezar: un compromiso contigo 💛</h2>
        <p>Sé que a veces el día a día no deja espacio para pensar en ti. Pero tu cuerpo lleva la cuenta, incluso cuando tú no la llevas. Comprometerte hoy — aunque sea con un paso chiquito — no es una exigencia más: es una forma real de decirte a ti misma que mereces cuidarte con constancia.</p>
        <p class="mt" style="font-weight:600">¿Con cuántos días quieres empezar este compromiso?</p>
        <div class="step-body">
          <div class="chips chips-1col" id="compromiso-chips"></div>
        </div>
      </div>
      <div class="quiz-nav"><button class="btn accent" disabled>Ver mi menú personalizado 🍽️</button></div>`;
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
