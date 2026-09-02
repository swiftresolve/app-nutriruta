// Dashboard diario: menú del día, agua, hábitos y acceso rápido al SOS.
//
// Orden pensado a propósito (no es solo la lista de features en el orden en
// que se construyeron): arriba lo que se usa gratis todos los días (paso del
// día, hábitos, agua, menú, SOS, plan de 7 días); Sana y la Misión —lo
// Premium— van después, cuando ya sentiste valor real, no antes.
import { getState, getWater, setWater, getHabits, toggleHabit, cravingPattern, checkAchievements, esc, isPremium, pasoDeHoy, pasoHechoHoy, pasoRacha, marcarPasoHecho, sanaApertura, esTextoReal, guardarReflexionHabitos, registrarComidaSeguida, comidaRegistrada, DEFAULT_HORA_COMIDAS } from '../store.js';
import { MISSION } from '../data/mission.js';
import { MEALS } from '../data/recipes.js';
import { EMERGENCY_PLAN } from '../data/emergencyPlan.js';
import { PROFILES } from '../data/profiles.js';
import { dailyMenu, swapMeal, trafficLight, displayIngredient, displayRecipe, textoConCantidad } from '../menu.js';
import { navigate, header, openModal, toast, susanaName } from '../app.js';
import { t } from '../i18n.js';
import { celebrateStreak, habitCheckPop } from '../streakAnim.js';
import { playCheckSound, playWaterSound, playSparkleSound, playCelebrateSound } from '../sound.js';
import { renderPathMap } from '../pathMap.js';
import { renderPrimerosPasos, primerosPasosVisible } from './primerosPasos.js';
import { renderCheckinBanner, checkinBannerVisible } from './checkin.js';
import { renderNotifPrompt, notifPromptVisible } from './notifPrompt.js';
import { openMealLogModal } from './mealLogModal.js';
import { openMealSwapModal } from './mealSwapModal.js';
import { openKitchenSearchModal } from './kitchenSearchModal.js';

const DAILY_HABITS = [
  { id: 'agua', nombre: 'Tomé suficiente agua 💧' },
  { id: 'movimiento', nombre: 'Me moví 30 minutos 🚶‍♀️' },
  { id: 'sin_azucar', nombre: 'Evité azúcar añadida 🍬' },
  { id: 'menu', nombre: 'Seguí el menú del día 🍽️' },
  { id: 'sueno', nombre: 'Dormí 7+ horas 😴' }
];
// "agua" y "menu" ya no se marcan a mano: se derivan de una acción real
// (vasos llenados de verdad / al menos 2 comidas del día abiertas) — para
// que no sean solo un tap sin haberlo hecho. Los otros 3 siguen siendo
// auto-reporte (no hay forma de verificarlos sin un wearable), pero piden
// una reflexión real al cruzar el umbral de racha (ver pedirReflexionHabitos).
const AUTO_HABITS = new Set(['agua', 'menu']);

export function renderDashboard(container) {
  header(container);
  const state = getState();
  const { user } = state;
  const hora = new Date().getHours();
  const saludo = t(hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches');
  const mood = sanaMood(state);

  // --- Saludo, en una sola tarjeta condensada (racha/escudos ya viven
  // de forma persistente arriba a la derecha, en el header) ---
  const hero = document.createElement('div');
  hero.className = 'card';
  hero.innerHTML = `
    <h2>${saludo}${user.nombre ? ', ' + esc(user.nombre) : ''} 🌿</h2>
    <p class="small">${t('Hoy es un buen día para cuidarte. Progreso, no perfección.')}</p>
    <div class="chips mt">${user.perfiles.map((p) => `<span class="tag perfil">${PROFILES[p].emoji} ${PROFILES[p].nombre}</span>`).join(' ')}</div>`;
  container.appendChild(hero);

  // --- Primeros pasos: checklist de onboarding, solo cuentas nuevas ---
  if (primerosPasosVisible()) {
    renderPrimerosPasos(container, () => renderDashboard(clearAndGet(container)));
  }

  // --- Check-in: tarjeta descartable, nunca modal automático ---
  if (checkinBannerVisible()) {
    renderCheckinBanner(container, () => renderDashboard(clearAndGet(container)));
  }

  // --- Notificaciones: se piden aquí, cuando ya hay una racha que
  // proteger, no enterrado en Ajustes. También descartable. ---
  if (notifPromptVisible()) {
    renderNotifPrompt(container, () => renderDashboard(clearAndGet(container)));
  }

  // --- Tu paso de hoy: la tarjeta principal del día, con Sana como voz ---
  const paso = pasoDeHoy();
  const pasoHecho = pasoHechoHoy();
  const pasoRachaActual = pasoRacha();
  const pasoCard = document.createElement('div');
  pasoCard.className = 'card';
  pasoCard.style.background = 'linear-gradient(135deg, var(--primary-soft), var(--secondary-soft))';
  pasoCard.style.border = 'none';
  pasoCard.innerHTML = `
    <div class="row" style="gap:12px;align-items:flex-start">
      <div class="sana-avatar">🌿${mood.badge ? `<span class="mood-badge">${mood.badge}</span>` : ''}</div>
      <div style="flex:1;min-width:0">
        <div class="spread"><h3>${t('Tu paso de hoy')}</h3>${pasoHecho ? `<span class="tag verde">${t('Hecho ✓')}</span>` : ''}</div>
        <p class="small mt" style="font-weight:600">${esc(paso.obstaculo)}</p>
        <p class="mt">${esc(paso.accion)}</p>
        <p class="small muted mt">${esc(paso.porque)}</p>
        ${pasoRachaActual >= 2 ? `<p class="small mt">🔥 ${t('{n} Días en Ruta dando tu paso', { n: pasoRachaActual })}</p>` : ''}
        <button class="btn ${pasoHecho ? 'ghost' : 'accent'} full mt" id="paso-btn" ${pasoHecho ? 'disabled' : ''}>${pasoHecho ? t('Completado por hoy 🌿') : t('Ya lo hice ✓')}</button>
      </div>
    </div>`;
  const pasoBtn = pasoCard.querySelector('#paso-btn');
  pasoBtn.addEventListener('click', () => {
    const rect = pasoBtn.getBoundingClientRect();
    habitCheckPop(rect.left + rect.width / 2, rect.top + rect.height / 2);
    playSparkleSound();
    const nuevaRacha = marcarPasoHecho();
    if (nuevaRacha >= 2) celebrateStreak(nuevaRacha);
    else toast('¡Bien hecho! 🌿');
    renderDashboard(clearAndGet(container));
  });
  container.appendChild(pasoCard);

  // --- Hábitos: el ciclo diario central, justo después del paso de hoy ---
  const checks = getHabits();
  const habitCard = document.createElement('div');
  habitCard.className = 'card';
  habitCard.innerHTML = `<h2>✅ ${t('Hábitos de hoy')}</h2><p class="small">${t('Marca al menos 3 para sumar a tu Ruta. Agua y menú se marcan solos.')}</p>`;
  for (const h of DAILY_HABITS) {
    const row = document.createElement('div');
    const auto = AUTO_HABITS.has(h.id);
    row.className = 'habit' + (checks[h.id] ? ' done' : '') + (auto ? ' habit-auto' : '');
    if (auto) {
      row.innerHTML = `
        <span class="habit-auto-dot" aria-hidden="true">${checks[h.id] ? '✓' : ''}</span>
        <label>${t(h.nombre)} <span class="muted small">· ${t('automático')}</span></label>`;
      habitCard.appendChild(row);
      continue;
    }
    row.innerHTML = `
      <input type="checkbox" id="h-${h.id}" ${checks[h.id] ? 'checked' : ''}>
      <label for="h-${h.id}">${t(h.nombre)}</label>`;
    const input = row.querySelector('input');
    input.addEventListener('change', (e) => {
      const marcando = e.target.checked;
      const completadosAntes = Object.values(checks).filter(Boolean).length;
      const cruzaUmbral = marcando && completadosAntes < 3 && completadosAntes + 1 >= 3;
      const confirmar = () => {
        if (marcando) {
          const rect = row.getBoundingClientRect();
          habitCheckPop(rect.left + 16, rect.top + rect.height / 2);
          playCheckSound();
        }
        const rachaAntes = getState().racha.actual;
        const escudoUsado = toggleHabit(h.id);
        celebrarSiSubioRacha(rachaAntes, escudoUsado);
        renderDashboard(clearAndGet(container));
      };
      if (cruzaUmbral) {
        e.target.checked = false; // se revierte visualmente hasta confirmar la reflexión
        pedirReflexionHabitos(confirmar);
      } else {
        confirmar();
      }
    });
    habitCard.appendChild(row);
  }
  container.appendChild(habitCard);

  // --- Agua ---
  const agua = getWater();
  const waterCard = document.createElement('div');
  waterCard.className = 'card';
  waterCard.innerHTML = `
    <div class="spread"><h2>${t('💧 Agua')}</h2><span class="muted small">${agua.vasos}/${agua.meta} ${t('vasos')}</span></div>
    <div class="water-glasses"></div>`;
  const glassesEl = waterCard.querySelector('.water-glasses');
  for (let i = 0; i < agua.meta; i++) {
    const g = document.createElement('button');
    g.className = 'glass' + (i < agua.vasos ? ' filled' : '');
    // SVG propio en vez del emoji 🥤: el emoji lo pinta cada sistema con su
    // propio color fijo (rojo/naranja en la mayoría), no se puede recolorear
    // por CSS. Con currentColor sí queda celeste, coherente con la paleta.
    g.innerHTML = '<svg viewBox="0 0 24 28" width="22" height="26"><path d="M4 2h16l-1.6 22.5a2 2 0 0 1-2 1.5H7.6a2 2 0 0 1-2-1.5L4 2z" fill="currentColor"/><path d="M4 8.5c2 1.4 4 1.4 6 0s4-1.4 6 0 4 1.4 6 0" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.4"/></svg>';
    g.setAttribute('aria-label', t('Vaso {n}', { n: i + 1 }));
    g.addEventListener('click', () => {
      const nuevo = i < agua.vasos ? i : i + 1;
      if (nuevo > agua.vasos) {
        const rect = g.getBoundingClientRect();
        habitCheckPop(rect.left + rect.width / 2, rect.top + rect.height / 2);
        playWaterSound();
      }
      const rachaAntes = getState().racha.actual;
      const { escudoUsado } = setWater(nuevo);
      if (nuevo >= agua.meta) toast(t('¡Meta de agua cumplida! 💧🎉'));
      celebrarSiSubioRacha(rachaAntes, escudoUsado);
      renderDashboard(clearAndGet(container));
    });
    glassesEl.appendChild(g);
  }
  container.appendChild(waterCard);

  // --- Aviso de patrón de antojos (función Premium) ---
  const patron = isPremium() ? cravingPattern() : null;
  if (patron) {
    const tip = document.createElement('div');
    tip.className = 'card';
    tip.style.borderLeft = '4px solid var(--accent)';
    tip.innerHTML = `<p class="small">💡 <strong>${t('Hemos notado')}</strong> ${t('que tus antojos suelen aparecer en la')} <strong>${patron}</strong>. ${t('Prepara con anticipación un snack saludable para ese momento.')}</p>`;
    container.appendChild(tip);
  }

  // --- Aviso de hidratación/ayuno para migrañas: mitad del día, poca agua ---
  if (user.perfiles.includes('migranas') && hora >= 14 && getWater().vasos <= 1) {
    const migTip = document.createElement('div');
    migTip.className = 'card';
    migTip.style.borderLeft = '4px solid var(--secondary)';
    migTip.innerHTML = `<p class="small">🧠💧 ${t('Vas con poca agua hoy y en migrañas los horarios y la hidratación importan tanto como la comida. Toma un vaso y no dejes pasar mucho tiempo sin comer.')}</p>`;
    container.appendChild(migTip);
  }

  // --- Menú del día: la ruta de hoy ---
  const menuCard = document.createElement('div');
  menuCard.className = 'card';
  menuCard.innerHTML = `<div class="spread"><h2>${t('🍽️ Tu ruta de hoy')}</h2></div><div id="menu-path"></div>`;
  container.appendChild(menuCard);

  // Hora de inicio real (24h) de cada comida, en el mismo orden que MEALS
  // — ya no es una franja fija igual para todo el mundo: cada quien la
  // ajusta a su rutina real en Ajustes (user.horaComidas). Si una cuenta
  // vieja no tiene este campo guardado (creada antes de que existiera),
  // cae en DEFAULT_HORA_COMIDAS por comida -- nunca en 0, que rompería la
  // ventana de "ahora" (todo el día caería en la última comida).
  const horasUsuario = getState().user.horaComidas || {};
  const HORAS_INICIO_COMIDA = MEALS.map((m) => Number.isFinite(horasUsuario[m.id]) ? horasUsuario[m.id] : DEFAULT_HORA_COMIDAS[m.id]);
  const horaActual = new Date().getHours();
  const menuHoy = dailyMenu();
  const menuItems = menuHoy.map(({ meal, recipe }, i) => {
    const horaInicio = HORAS_INICIO_COMIDA[i] ?? 0;
    const horaSiguiente = HORAS_INICIO_COMIDA[i + 1] ?? 24;
    const esAhora = horaActual >= horaInicio && horaActual < horaSiguiente;
    // Completado de verdad = registró (foto/voz/texto) lo que comió en esa
    // estación, no solo que abrió la receta sugerida (eso es comidasSeguidas,
    // una señal distinta y más floja que ya existía).
    const registro = comidaRegistrada(meal.id);
    if (!recipe) {
      return { icon: meal.emoji, title: t(meal.nombre), subtitle: t('Sin opciones con tus exclusiones actuales'), now: esAhora, nowLabel: t('Ahora'), done: !!registro };
    }
    const { perfiles, exclusiones } = getState().user;
    const light = trafficLight(recipe, perfiles);
    const shown = displayRecipe(recipe, exclusiones);
    return {
      icon: meal.emoji, title: t(meal.nombre),
      subtitle: registro ? registro.alimentos.join(', ') : shown.nombre,
      now: esAhora, nowLabel: t('Ahora'), done: !!registro,
      onClick: () => {
        // Abrir una comida real del menú de hoy es la señal de "seguí el
        // menú" — con 2 comidas abiertas se marca sola (ver store.js).
        const rachaAntes = getState().racha.actual;
        const { escudoUsado } = registrarComidaSeguida(recipe.id) || {};
        celebrarSiSubioRacha(rachaAntes, escudoUsado);
        openRecipe(recipe);
      },
      extraHtml: `<div class="row mt" style="gap:8px">
        <span class="dot ${light}"></span>
        <button type="button" class="icon-btn swap-btn" title="${t('Cambiar receta')}" aria-label="${t('Cambiar receta')}">🔄</button>
        <button type="button" class="icon-btn log-btn" title="${registro ? t('Editar lo que comiste') : t('¿Qué comiste realmente?')}" aria-label="${registro ? t('Editar lo que comiste') : t('Registrar lo que comiste')}">${registro ? '✏️' : '📸'}</button>
      </div>`
    };
  });
  renderPathMap(menuCard.querySelector('#menu-path'), menuItems, { showLine: false });
  menuHoy.forEach(({ meal, recipe }, i) => {
    const logBtn = menuCard.querySelector(`[data-row-idx="${i}"] .log-btn`);
    if (logBtn) logBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMealLogModal(meal.id, meal.nombre, () => renderDashboard(clearAndGet(container)));
    });
    if (!recipe) return;
    const btn = menuCard.querySelector(`[data-row-idx="${i}"] .swap-btn`);
    if (btn) btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { exclusiones } = getState().user;
      openMealSwapModal(meal.id, meal.nombre, exclusiones, () => renderDashboard(clearAndGet(container)));
    });
  });

  const menuActions = document.createElement('div');
  menuActions.className = 'row wrap mt';
  menuActions.style.marginTop = '20px';
  const shopBtn = document.createElement('button');
  shopBtn.className = 'btn ghost sm';
  shopBtn.textContent = t('🛒 Ver lista de compras');
  shopBtn.addEventListener('click', () => navigate('planner', { tab: 'compras' }));
  menuActions.appendChild(shopBtn);
  const kitchenBtn = document.createElement('button');
  kitchenBtn.className = 'btn ghost sm';
  kitchenBtn.textContent = t('🔍 ¿Qué tienes en casa?');
  kitchenBtn.addEventListener('click', () => openKitchenSearchModal((recipe) => openRecipe(recipe)));
  menuActions.appendChild(kitchenBtn);
  const weekBtn = document.createElement('button');
  weekBtn.className = 'btn ghost sm';
  weekBtn.textContent = t('📅 Ver la semana');
  weekBtn.addEventListener('click', () => navigate('weekMenu'));
  menuActions.appendChild(weekBtn);
  const diaryBtn = document.createElement('button');
  diaryBtn.className = 'btn ghost sm';
  diaryBtn.textContent = t('📔 Mi Diario');
  diaryBtn.addEventListener('click', () => navigate('diary'));
  menuActions.appendChild(diaryBtn);
  menuCard.appendChild(menuActions);

  // --- Botón SOS ---
  const sosBtn = document.createElement('button');
  sosBtn.className = 'btn accent full mb';
  sosBtn.innerHTML = t('💚 Tengo ansiedad / antojo');
  sosBtn.addEventListener('click', () => navigate('sos'));
  container.appendChild(sosBtn);

  // --- Plan de 7 días (gratis, respuesta inmediata) ---
  // Antes esta tarjeta desaparecía del todo al llegar a 7/7 -- y como es el
  // ÚNICO punto de entrada a la vista 'emergency' en toda la app (no hay
  // link en Progreso, Ajustes ni la nav), completar el plan lo dejaba
  // inaccesible para siempre, aunque la vista sí tiene un cierre armado
  // para ese estado. Ahora se queda, con su propia variante de completado.
  const { emergencia } = getState();
  const diasCompletados = (emergencia?.completados || []).length;
  const emergCard = document.createElement('div');
  emergCard.className = 'card';
  emergCard.style.borderLeft = '4px solid var(--accent)';
  if (diasCompletados >= 7) {
    emergCard.innerHTML = `
      <div class="spread"><h3>${t('🏁 Plan de 7 días')}</h3><span class="tag verde">${t('Completado')}</span></div>
      <p class="small">${t('Diste el primer paso — revisa tu semana cuando quieras.')}</p>
      <button class="link-btn small">${t('Ver mi plan →')}</button>`;
  } else if (emergencia?.inicio) {
    emergCard.innerHTML = `
      <div class="spread"><h3>${t('🏁 Plan de 7 días')}</h3><span class="tag verde">${diasCompletados}/7</span></div>
      <div class="quiz-progress mt" style="margin-bottom:6px"><div style="width:${Math.round((diasCompletados / 7) * 100)}%"></div></div>
      <button class="link-btn small">${t('Continuar mi plan →')}</button>`;
  } else {
    emergCard.innerHTML = `
      <div class="spread"><h3>${t('🏁 Plan de 7 días')}</h3><span class="tag info">${t('Gratis')}</span></div>
      <p class="small">${EMERGENCY_PLAN.descripcion}</p>
      <button class="link-btn small">${t('Empezar hoy mismo →')}</button>`;
  }
  emergCard.querySelector('.link-btn').addEventListener('click', () => navigate('emergency'));
  container.appendChild(emergCard);

  // --- Lo Premium va al final: ya viviste el valor gratis, ahora la invitación ---

  // --- Pregúntale a tu guía ---
  const guideCard = document.createElement('div');
  guideCard.className = 'card';
  guideCard.style.background = 'linear-gradient(135deg, var(--primary-soft), var(--secondary-soft))';
  guideCard.style.border = 'none';
  const subtitulo = isPremium() ? esc(sanaApertura()) : t('Una duda puntual, ahora mismo, con el contexto de tu perfil.');
  guideCard.innerHTML = `
    <div class="spread"><h3>💬 ${susanaName()}${t(', tu guía')}</h3>${isPremium() ? '' : `<span class="tag info">${t('Premium')}</span>`}</div>
    <p class="small mt">${subtitulo}</p>
    <button class="btn ghost sm mt">${isPremium() ? t('Abrir chat →') : t('Conocer más →')}</button>`;
  guideCard.querySelector('.btn').addEventListener('click', () => navigate('assistant'));
  container.appendChild(guideCard);

  // --- Misión 12 semanas ---
  const { mision } = getState();
  const misionCard = document.createElement('div');
  misionCard.className = 'card';
  misionCard.style.borderLeft = '4px solid var(--primary)';
  if (mision && mision.inicio) {
    const done = (mision.completadas || []).length;
    const activa = isPremium();
    misionCard.innerHTML = `
      <div class="spread"><h3>${t('🎯 Misión 12 semanas')}</h3><span class="tag ${activa ? 'verde' : 'rojo'}">${activa ? `${done}/12` : t('Pausada')}</span></div>
      <div class="quiz-progress mt" style="margin-bottom:6px"><div style="width:${Math.round((done / 12) * 100)}%"></div></div>
      <button class="link-btn small">${activa ? t('Continuar mi misión →') : t('Renovar Premium para continuar →')}</button>`;
  } else {
    misionCard.innerHTML = `
      <div class="spread"><h3>${t('🎯 Misión 12 semanas')}</h3>${isPremium() ? '' : `<span class="tag info">${t('Premium')}</span>`}</div>
      <p class="small">${MISSION.descripcion}</p>
      <button class="link-btn small">${isPremium() ? t('Empezar mi misión →') : t('Conocer la misión →')}</button>`;
  }
  misionCard.querySelector('.link-btn').addEventListener('click', () => navigate('mission'));
  container.appendChild(misionCard);
}

// Estado de ánimo de Sana: se deriva 100% de datos que ya existen (último
// check-in, racha, hábitos de hoy) — nada nuevo que trackear. Nunca es
// negativa de más: ante la duda, la lectura queda en calma.
function sanaMood(state) {
  const ultimo = state.checkins?.length ? state.checkins[state.checkins.length - 1] : null;
  const animoDificil = ultimo?.animo === 'dificil';
  const habitosHoy = Object.values(state.habitos?.checks || {}).filter(Boolean).length;
  const rachaEnRiesgo = (state.racha?.actual || 0) >= 2 && habitosHoy < 3 && new Date().getHours() >= 18;
  if (animoDificil || rachaEnRiesgo) return { badge: '🤗' };
  if ((state.racha?.actual || 0) >= 3) return { badge: '✨' };
  return { badge: '' };
}

function clearAndGet(container) {
  container.innerHTML = '';
  return container;
}

// Compartido entre el toggle de hábitos, el agua y el abrir una comida del
// menú — cualquiera de los tres puede ser lo que complete el día.
function celebrarSiSubioRacha(rachaAntes, escudoUsado) {
  const rachaDespues = getState().racha.actual;
  const nuevos = checkAchievements();
  if (escudoUsado) toast('🛡️ Usamos una Pausa de Ruta — tu Ruta sigue en pie');
  if (rachaDespues > rachaAntes) {
    const checksAhora = getHabits();
    const completados = Object.values(checksAhora).filter(Boolean).length;
    const aguaAhora = getWater();
    playCelebrateSound();
    celebrateStreak(rachaDespues, { habitos: completados, totalHabitos: DAILY_HABITS.length, vasos: aguaAhora.vasos, meta: aguaAhora.meta });
  }
  if (nuevos.length) toast('🏆 ¡Nuevo logro desbloqueado! Míralo en Progreso.');
}

// Reflexión breve (anti-trampa, ver memoria) justo al cruzar el umbral de
// 3 hábitos: pedir una frase real de qué se hizo es más fácil de cumplir
// honestamente que de inventar en frío. Solo aplica a los 3 hábitos que
// siguen siendo auto-reporte (movimiento, azúcar, sueño) — agua y menú ya
// se derivan de una acción real y no pasan por aquí.
function pedirReflexionHabitos(onConfirm) {
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2rem">✍️</div>
      <h2>Antes de sumar hoy…</h2>
      <p class="small mt">En una frase, ¿qué hiciste hoy para esto? Nos ayuda a que tu Ruta refleje algo real, no solo un toque.</p>
      <textarea id="reflexion-habitos" maxlength="300" rows="3" placeholder="Ej: Caminé 30 minutos después de almorzar..."
        style="width:100%;padding:12px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit;margin-top:8px;resize:vertical"></textarea>`);
    const textarea = modal.querySelector('#reflexion-habitos');
    const btn = document.createElement('button');
    btn.className = 'btn full mt';
    btn.textContent = 'Sumar a mi Ruta ✓';
    btn.disabled = true;
    textarea.addEventListener('input', () => { btn.disabled = !esTextoReal(textarea.value, 12); });
    btn.addEventListener('click', () => {
      guardarReflexionHabitos(textarea.value);
      close();
      onConfirm();
    });
    modal.appendChild(btn);
  });
}

// Detalle de receta en modal (compartido conceptualmente con planner).
export function openRecipe(recipe) {
  const { user } = getState();
  openModal((modal) => {
    const light = trafficLight(recipe, user.perfiles);
    const shown = displayRecipe(recipe, user.exclusiones);
    const ings = recipe.ingredientes.map((ing) => {
      const d = displayIngredient(ing, user.exclusiones);
      const texto = (d.cantidad != null && d.resto) ? textoConCantidad(d.cantidad, d.resto, user.unidades) : d.texto;
      return `<div class="ingredient">• ${texto}${d.sustituido ? ` <span class="sub-note">(${t('sustituto de')} ${d.original})</span>` : ''}</div>`;
    }).join('');
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2.4rem">${shown.emoji}</div>
      <h2>${shown.nombre}</h2>
      <p class="small">${recipe.descripcion}</p>
      <p class="mt"><span class="tag ${light}">${t('Semáforo')}: ${light}</span>
        ${recipe.apto.filter((p) => user.perfiles.includes(p)).map((p) => `<span class="tag perfil">${PROFILES[p].nombre}</span>`).join(' ')}</p>
      <h3 class="mt">${t('Ingredientes')}</h3>${ings}
      <h3 class="mt">${t('Preparación')}</h3>
      <ol class="steps">${recipe.pasos.map((p) => `<li>${p}</li>`).join('')}</ol>`);
  });
}
