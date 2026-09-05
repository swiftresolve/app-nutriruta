// SOS antojo: recorrido guiado de varias pantallas (no una sola pantalla
// con tarjetas apiladas, ni modales) -- mismo motor de "pantalla completa
// con barra de progreso" que usa el quiz (ver #app.quiz-active en CSS y
// quiz-active en app.js, que ahora también cubre la ruta 'sos'). Pedido
// explícito de la usuaria: cada paso es su propia pantalla, y la
// respiración guiada tiene una pantalla dedicada, sin nada más alrededor.
import { getState, toggleFavorita, logCraving, checkAchievements } from '../store.js';
import { MEALS } from '../data/recipes.js';
import { sosSnacks, displayRecipe, trafficLight } from '../menu.js';
import { navigate, toast } from '../app.js';
import { openRecipe } from './dashboard.js';
import { playInhaleSound, playExhaleSound } from '../sound.js';
import { TAG_LABELS, HOT_MEALS } from './planner.js';

const CRAVING_TYPES = [
  { id: 'dulce', nombre: '🍫 Dulce' },
  { id: 'salado', nombre: '🍟 Salado / paquete' },
  { id: 'alcohol', nombre: '🍺 Alcohol' },
  { id: 'picoteo', nombre: '🌙 Picoteo nocturno' },
  { id: 'no_se', nombre: '🤷‍♀️ No sé, solo ansiedad' }
];

export function renderSOS(container) {
  let step = 0;
  let tipo = null;
  // Limpieza del paso que se está por abandonar -- hoy solo la usa la
  // respiración (cancelar el ciclo pendiente y cortar el sonido en curso
  // si se sale a mitad de un inhala/exhala, con Continuar o Atrás).
  let limpiarPaso = null;

  function draw() {
    limpiarPaso?.();
    limpiarPaso = null;
    container.innerHTML = '';
    const total = 5;
    const pct = Math.round(((step + 1) / total) * 100);
    const esRespiracion = step === 1;

    const view = document.createElement('div');
    view.className = 'quiz-step' + (esRespiracion ? ' sos-breath-step' : '');
    view.innerHTML = `
      <div class="quiz-topbar">
        <button class="quiz-topbar-back" aria-label="${step === 0 ? 'Salir' : 'Atrás'}"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="quiz-progress"><div style="width:${pct}%"></div></div>
      </div>
      <div class="quiz-content">
        <div class="step-body"></div>
      </div>
      <div class="quiz-nav"></div>`;

    view.querySelector('.quiz-topbar-back').addEventListener('click', () => {
      if (step === 0) navigate('dashboard');
      else { step--; draw(); }
    });

    const body = view.querySelector('.step-body');
    const navEl = view.querySelector('.quiz-nav');

    if (step === 0) pintarTipo(body, navEl);
    else if (step === 1) pintarRespiracion(body, navEl);
    else if (step === 2) pintarHambre(body, navEl);
    else if (step === 3) pintarAlternativas(body, navEl);
    else pintarRegistrar(body, navEl);

    container.appendChild(view);
  }

  function botonContinuar(navEl, { disabled = false, texto = 'Continuar' } = {}) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn full';
    btn.textContent = texto;
    btn.disabled = disabled;
    btn.addEventListener('click', () => { step++; draw(); });
    navEl.appendChild(btn);
    return btn;
  }

  // Paso 1: identificar el antojo.
  function pintarTipo(body, navEl) {
    body.innerHTML = `
      <h2>¿Qué tipo de antojo sientes?</h2>
      <p>Respira. Estás bien 💚 No es falta de fuerza de voluntad -- es un momento, y va a pasar. Vamos paso a paso.</p>
      <div class="chips chips-1col mt"></div>`;
    const wrap = body.querySelector('.chips');
    const next = botonContinuar(navEl, { disabled: !tipo });
    for (const t of CRAVING_TYPES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (tipo === t.id ? ' selected' : '');
      b.textContent = t.nombre;
      b.addEventListener('click', () => {
        tipo = t.id;
        wrap.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
        b.classList.add('selected');
        next.disabled = false;
      });
      wrap.appendChild(b);
    }
  }

  // Paso 2: pausa consciente -- pantalla propia, sin nada más alrededor,
  // ver .sos-breath-step en CSS (fondo con degradado suave, círculo grande).
  function pintarRespiracion(body, navEl) {
    body.innerHTML = `
      <div class="sos-breath-screen">
        <h2>La pausa de 1 minuto</h2>
        <p class="small">Antes de decidir, respira conmigo 5 veces.</p>
        <div class="breath-wrap"><div class="breath-circle" id="breath">Toca<br>para empezar</div></div>
        <p class="small muted" id="breath-label">&nbsp;</p>
      </div>`;
    const next = botonContinuar(navEl, { disabled: true, texto: 'Continuar' });
    const circle = body.querySelector('#breath');
    const label = body.querySelector('#breath-label');
    let breathing = false;
    let pendingTimeout = null;
    let sonidoActual = null;
    limpiarPaso = () => {
      clearTimeout(pendingTimeout);
      sonidoActual?.stop();
    };
    circle.addEventListener('click', () => {
      if (breathing) return;
      breathing = true;
      let cycle = 0;
      const doCycle = () => {
        if (cycle >= 5) {
          circle.classList.remove('in');
          circle.innerHTML = '<span class="breath-done"><span class="breath-done-emoji">🌿</span>¡Bien hecho!</span>';
          label.textContent = '¿Cómo te sientes ahora?';
          breathing = false;
          next.disabled = false;
          return;
        }
        cycle++;
        circle.classList.add('in');
        circle.textContent = 'Inhala';
        sonidoActual = playInhaleSound();
        pendingTimeout = setTimeout(() => {
          circle.classList.remove('in');
          circle.textContent = 'Exhala';
          label.textContent = `Respiración ${cycle} de 5`;
          sonidoActual = playExhaleSound();
          pendingTimeout = setTimeout(doCycle, 3500);
        }, 3500);
      };
      doCycle();
    });
  }

  // Paso 3: hambre física vs emocional -- reflexión, sin selección forzada.
  function pintarHambre(body, navEl) {
    body.innerHTML = `
      <h2>¿Hambre física o emocional?</h2>
      <p><strong>Hambre física:</strong> llegó poco a poco y aceptarías cualquier comida.</p>
      <p class="mt"><strong>Hambre emocional:</strong> llegó de golpe y pide algo muy específico.</p>`;
    botonContinuar(navEl);
  }

  // Paso 4: alternativas -- misma tarjeta que el Recetario (plato, aro de
  // semáforo, vapor si aplica, tags, favorito), no una versión reducida
  // aparte. Ya vienen priorizadas por perfil de salud (ver sosSnacks en
  // menu.js, mismo criterio "apto" que candidatesFor).
  function pintarAlternativas(body, navEl) {
    body.innerHTML = `
      <h2>Elige tu alternativa saludable</h2>
      <p>Elegidas para tu perfil de salud y tus exclusiones:</p>
      <div class="recipe-grid mt"></div>`;
    const { user, favoritas } = getState();
    const { exclusiones, perfiles } = user;
    const mealById = MEALS.reduce((m, x) => (m[x.id] = x, m), {});
    const grid = body.querySelector('.recipe-grid');
    for (const r of sosSnacks().slice(0, 6)) {
      const shown = displayRecipe(r, exclusiones);
      const light = trafficLight(r, perfiles);
      const tags = (r.etiquetas || []).slice(0, 2).map((t) => `<span class="recipe-tag">${TAG_LABELS[t] || t}</span>`).join('');
      const esFavorita = (favoritas || []).includes(r.id);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'recipe-card';
      item.innerHTML = `
        <span class="recipe-fav" aria-label="${esFavorita ? 'Quitar de preferidos' : 'Marcar como preferida'}">${esFavorita ? '⭐' : '☆'}</span>
        <div class="recipe-plate">
          ${HOT_MEALS.has(r.comida) ? '<span class="steam"><span></span><span></span><span></span></span>' : ''}
          ${shown.emoji}
          <span class="garnish">${mealById[r.comida]?.emoji || ''}</span>
          <span class="semaforo-ring ${light}" title="Semáforo: ${light}"></span>
        </div>
        <div class="recipe-title">${shown.nombre}</div>
        <div class="recipe-desc">${r.descripcion}</div>
        <div class="recipe-tags">${tags}</div>`;
      item.querySelector('.recipe-fav').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorita(r.id);
        pintarAlternativas(body, navEl);
      });
      item.addEventListener('click', () => openRecipe(r));
      grid.appendChild(item);
    }
    botonContinuar(navEl);
  }

  // Paso 5: registrar resultado -- 2 acciones terminales en vez de "Continuar".
  function pintarRegistrar(body) {
    body.innerHTML = `
      <h2>Registra cómo terminó</h2>
      <p>Registrar te ayuda a detectar tus patrones. Sin culpa: todo dato sirve.</p>
      <button type="button" class="btn full mt" id="sos-ok">✅ Usé una alternativa saludable</button>
      <button type="button" class="btn ghost full mt" id="sos-cedio">🤍 Esta vez cedí al antojo</button>`;
    body.querySelector('#sos-ok').addEventListener('click', () => {
      logCraving(tipo || 'no_se', 'alternativa');
      checkAchievements();
      navigate('dashboard');
      toast('💚 Registrado. ¡Cada vez que eliges distinto, reentrenas tu hábito!');
    });
    body.querySelector('#sos-cedio').addEventListener('click', () => {
      logCraving(tipo || 'no_se', 'cedio');
      navigate('dashboard');
      toast('Está bien. Progreso, no perfección. Mañana seguimos 💛');
    });
  }

  draw();
}
