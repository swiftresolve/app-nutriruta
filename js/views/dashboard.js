// Dashboard diario: menú del día, agua, hábitos y acceso rápido al SOS.
import { getState, getWater, setWater, getHabits, toggleHabit, cravingPattern, checkAchievements, esc, isPremium, pasoDeHoy, pasoHechoHoy, pasoRacha, marcarPasoHecho } from '../store.js';
import { MISSION } from '../data/mission.js';
import { EMERGENCY_PLAN } from '../data/emergencyPlan.js';
import { PROFILES } from '../data/profiles.js';
import { dailyMenu, swapMeal, trafficLight, displayIngredient, displayRecipe } from '../menu.js';
import { navigate, header, openModal, toast } from '../app.js';
import { celebrateStreak } from '../streakAnim.js';
import { renderPathMap } from '../pathMap.js';

const DAILY_HABITS = [
  { id: 'agua', nombre: 'Tomé suficiente agua 💧' },
  { id: 'movimiento', nombre: 'Me moví 30 minutos 🚶‍♀️' },
  { id: 'sin_azucar', nombre: 'Evité azúcar añadida 🍬' },
  { id: 'menu', nombre: 'Seguí el menú del día 🍽️' },
  { id: 'sueno', nombre: 'Dormí 7+ horas 😴' }
];

export function renderDashboard(container) {
  header(container);
  const { user } = getState();
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  // --- Saludo + perfiles activos ---
  const hero = document.createElement('div');
  hero.className = 'card';
  hero.innerHTML = `
    <h2>${saludo}${user.nombre ? ', ' + esc(user.nombre) : ''} 🌿</h2>
    <p class="small">Hoy es un buen día para cuidarte. Progreso, no perfección.</p>
    <div class="chips mt">${user.perfiles.map((p) => `<span class="tag perfil">${PROFILES[p].emoji} ${PROFILES[p].nombre}</span>`).join(' ')}</div>`;
  container.appendChild(hero);

  // --- Tu paso de hoy: obstáculo + micro-acción concreta, gratis para todas ---
  const paso = pasoDeHoy();
  const pasoHecho = pasoHechoHoy();
  const racha = pasoRacha();
  const pasoCard = document.createElement('div');
  pasoCard.className = 'card';
  pasoCard.style.borderLeft = '4px solid var(--primary)';
  pasoCard.innerHTML = `
    <div class="spread"><h3>🌿 Tu paso de hoy</h3>${pasoHecho ? '<span class="tag verde">Hecho ✓</span>' : ''}</div>
    <p class="small mt" style="font-weight:600">${esc(paso.obstaculo)}</p>
    <p class="mt">${esc(paso.accion)}</p>
    <p class="small muted mt">${esc(paso.porque)}</p>
    ${racha >= 2 ? `<p class="small mt">🔥 ${racha} días seguidos dando tu paso</p>` : ''}
    <button class="btn ${pasoHecho ? 'ghost' : 'accent'} full mt" id="paso-btn" ${pasoHecho ? 'disabled' : ''}>${pasoHecho ? 'Completado por hoy 🌿' : 'Ya lo hice ✓'}</button>`;
  const pasoBtn = pasoCard.querySelector('#paso-btn');
  pasoBtn.addEventListener('click', () => {
    const nuevaRacha = marcarPasoHecho();
    if (nuevaRacha >= 2) celebrateStreak(nuevaRacha);
    else toast('¡Bien hecho! 🌿');
    renderDashboard(clearAndGet(container));
  });
  container.appendChild(pasoCard);

  // --- Pregúntale a tu guía (asistente Premium, entrada destacada) ---
  const guideCard = document.createElement('div');
  guideCard.className = 'card';
  guideCard.style.background = 'linear-gradient(135deg, var(--primary-soft), var(--secondary-soft))';
  guideCard.style.border = 'none';
  guideCard.innerHTML = `
    <div class="spread"><h3>💬 Sana, tu guía</h3>${isPremium() ? '' : '<span class="tag info">Premium</span>'}</div>
    <p class="small mt">Una duda puntual, ahora mismo, con el contexto de tu perfil.</p>
    <button class="btn ghost sm mt">${isPremium() ? 'Abrir chat →' : 'Conocer más →'}</button>`;
  guideCard.querySelector('.btn').addEventListener('click', () => navigate('assistant'));
  container.appendChild(guideCard);

  // --- Aviso de patrón de antojos (función Premium) ---
  const patron = isPremium() ? cravingPattern() : null;
  if (patron) {
    const tip = document.createElement('div');
    tip.className = 'card';
    tip.style.borderLeft = '4px solid var(--accent)';
    tip.innerHTML = `<p class="small">💡 <strong>Hemos notado</strong> que tus antojos suelen aparecer en la <strong>${patron}</strong>. Prepara con anticipación un snack saludable para ese momento.</p>`;
    container.appendChild(tip);
  }

  // --- Aviso de hidratación/ayuno para migrañas: mitad del día, poca agua ---
  if (user.perfiles.includes('migranas') && hora >= 14 && getWater().vasos <= 1) {
    const migTip = document.createElement('div');
    migTip.className = 'card';
    migTip.style.borderLeft = '4px solid var(--secondary)';
    migTip.innerHTML = '<p class="small">🧠💧 Vas con poca agua hoy y en migrañas los horarios y la hidratación importan tanto como la comida. Toma un vaso y no dejes pasar mucho tiempo sin comer.</p>';
    container.appendChild(migTip);
  }

  // --- Plan de 7 días (gratis, respuesta inmediata) ---
  const { emergencia } = getState();
  const diasCompletados = (emergencia?.completados || []).length;
  if (diasCompletados < 7) {
    const emergCard = document.createElement('div');
    emergCard.className = 'card';
    emergCard.style.borderLeft = '4px solid var(--accent)';
    if (emergencia?.inicio) {
      emergCard.innerHTML = `
        <div class="spread"><h3>🏁 Plan de 7 días</h3><span class="tag verde">${diasCompletados}/7</span></div>
        <div class="quiz-progress mt" style="margin-bottom:6px"><div style="width:${Math.round((diasCompletados / 7) * 100)}%"></div></div>
        <button class="link-btn small">Continuar mi plan →</button>`;
    } else {
      emergCard.innerHTML = `
        <div class="spread"><h3>🏁 Plan de 7 días</h3><span class="tag info">Gratis</span></div>
        <p class="small">${EMERGENCY_PLAN.descripcion}</p>
        <button class="link-btn small">Empezar hoy mismo →</button>`;
    }
    emergCard.querySelector('.link-btn').addEventListener('click', () => navigate('emergency'));
    container.appendChild(emergCard);
  }

  // --- Misión 12 semanas ---
  const { mision } = getState();
  const misionCard = document.createElement('div');
  misionCard.className = 'card';
  misionCard.style.borderLeft = '4px solid var(--primary)';
  if (mision && mision.inicio) {
    const done = (mision.completadas || []).length;
    const activa = isPremium();
    misionCard.innerHTML = `
      <div class="spread"><h3>🎯 Misión 12 semanas</h3><span class="tag ${activa ? 'verde' : 'rojo'}">${activa ? `${done}/12` : 'Pausada'}</span></div>
      <div class="quiz-progress mt" style="margin-bottom:6px"><div style="width:${Math.round((done / 12) * 100)}%"></div></div>
      <button class="link-btn small">${activa ? 'Continuar mi misión →' : 'Renovar Premium para continuar →'}</button>`;
  } else {
    misionCard.innerHTML = `
      <div class="spread"><h3>🎯 Misión 12 semanas</h3>${isPremium() ? '' : '<span class="tag info">Premium</span>'}</div>
      <p class="small">${MISSION.descripcion}</p>
      <button class="link-btn small">${isPremium() ? 'Empezar mi misión →' : 'Conocer la misión →'}</button>`;
  }
  misionCard.querySelector('.link-btn').addEventListener('click', () => navigate('mission'));
  container.appendChild(misionCard);

  // --- Botón SOS ---
  const sosBtn = document.createElement('button');
  sosBtn.className = 'btn accent full mb';
  sosBtn.innerHTML = '💚 Tengo ansiedad / antojo';
  sosBtn.addEventListener('click', () => navigate('sos'));
  container.appendChild(sosBtn);

  // --- Agua ---
  const agua = getWater();
  const waterCard = document.createElement('div');
  waterCard.className = 'card';
  waterCard.innerHTML = `
    <div class="spread"><h2>💧 Agua</h2><span class="muted small">${agua.vasos}/${agua.meta} vasos</span></div>
    <div class="water-glasses"></div>`;
  const glassesEl = waterCard.querySelector('.water-glasses');
  for (let i = 0; i < agua.meta; i++) {
    const g = document.createElement('button');
    g.className = 'glass' + (i < agua.vasos ? ' filled' : '');
    g.textContent = '🥤';
    g.setAttribute('aria-label', `Vaso ${i + 1}`);
    g.addEventListener('click', () => {
      const nuevo = i < agua.vasos ? i : i + 1;
      setWater(nuevo);
      if (nuevo >= agua.meta) toast('¡Meta de agua cumplida! 💧🎉');
      renderDashboard(clearAndGet(container));
    });
    glassesEl.appendChild(g);
  }
  container.appendChild(waterCard);

  // --- Menú del día: la ruta de hoy, misma línea que Misión y Plan de 7 días ---
  const menuCard = document.createElement('div');
  menuCard.className = 'card';
  menuCard.innerHTML = '<div class="spread"><h2>🍽️ Tu ruta de hoy</h2></div><div id="menu-path"></div>';
  container.appendChild(menuCard);

  // Horas de inicio reales (24h) de cada comida, en el mismo orden que
  // MEALS — no se parsean del texto mostrado ("4:00 pm") porque parseInt
  // no distingue am/pm y calcularía mal la tarde/noche.
  const HORAS_INICIO_COMIDA = [7, 10, 12, 16, 19];
  const horaActual = new Date().getHours();
  const menuHoy = dailyMenu();
  const menuItems = menuHoy.map(({ meal, recipe }, i) => {
    const horaInicio = HORAS_INICIO_COMIDA[i] ?? 0;
    const horaSiguiente = HORAS_INICIO_COMIDA[i + 1] ?? 24;
    const esAhora = horaActual >= horaInicio && horaActual < horaSiguiente;
    if (!recipe) {
      return { icon: meal.emoji, title: meal.nombre, subtitle: 'Sin opciones con tus exclusiones actuales', now: esAhora, nowLabel: 'Ahora' };
    }
    const { perfiles, exclusiones } = getState().user;
    const light = trafficLight(recipe, perfiles);
    const shown = displayRecipe(recipe, exclusiones);
    return {
      icon: meal.emoji, title: meal.nombre, subtitle: shown.nombre, now: esAhora, nowLabel: 'Ahora',
      onClick: () => openRecipe(recipe),
      extraHtml: `<div class="row mt" style="gap:8px"><span class="dot ${light}"></span><button type="button" class="icon-btn swap-btn" title="Cambiar receta" aria-label="Cambiar receta">🔄</button></div>`
    };
  });
  renderPathMap(menuCard.querySelector('#menu-path'), menuItems);
  menuHoy.forEach(({ meal, recipe }, i) => {
    if (!recipe) return;
    const btn = menuCard.querySelector(`[data-wrap-idx="${i}"] .swap-btn`);
    if (btn) btn.addEventListener('click', (e) => {
      e.stopPropagation();
      swapMeal(meal.id);
      renderDashboard(clearAndGet(container));
    });
  });

  const shopBtn = document.createElement('button');
  shopBtn.className = 'btn ghost sm mt';
  shopBtn.textContent = '🛒 Ver lista de compras';
  shopBtn.addEventListener('click', () => navigate('planner', { tab: 'compras' }));
  menuCard.appendChild(shopBtn);

  // --- Hábitos ---
  const checks = getHabits();
  const habitCard = document.createElement('div');
  habitCard.className = 'card';
  habitCard.innerHTML = '<h2>✅ Hábitos de hoy</h2><p class="small">Marca al menos 3 para sumar a tu racha.</p>';
  for (const h of DAILY_HABITS) {
    const row = document.createElement('div');
    row.className = 'habit' + (checks[h.id] ? ' done' : '');
    row.innerHTML = `
      <input type="checkbox" id="h-${h.id}" ${checks[h.id] ? 'checked' : ''}>
      <label for="h-${h.id}">${h.nombre}</label>`;
    row.querySelector('input').addEventListener('change', () => {
      const rachaAntes = getState().racha.actual;
      toggleHabit(h.id);
      const rachaDespues = getState().racha.actual;
      const nuevos = checkAchievements();
      if (rachaDespues > rachaAntes) celebrateStreak(rachaDespues);
      if (nuevos.length) toast('🏆 ¡Nuevo logro desbloqueado! Míralo en Progreso.');
      renderDashboard(clearAndGet(container));
    });
    habitCard.appendChild(row);
  }
  container.appendChild(habitCard);
}

function clearAndGet(container) {
  container.innerHTML = '';
  return container;
}

// Detalle de receta en modal (compartido conceptualmente con planner).
export function openRecipe(recipe) {
  const { user } = getState();
  openModal((modal) => {
    const light = trafficLight(recipe, user.perfiles);
    const shown = displayRecipe(recipe, user.exclusiones);
    const ings = recipe.ingredientes.map((ing) => {
      const d = displayIngredient(ing, user.exclusiones);
      return `<div class="ingredient">• ${d.texto}${d.sustituido ? ` <span class="sub-note">(sustituto de ${d.original})</span>` : ''}</div>`;
    }).join('');
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2.4rem">${shown.emoji}</div>
      <h2>${shown.nombre}</h2>
      <p class="small">${recipe.descripcion}</p>
      <p class="mt"><span class="tag ${light}">Semáforo: ${light}</span>
        ${recipe.apto.filter((p) => user.perfiles.includes(p)).map((p) => `<span class="tag perfil">${PROFILES[p].nombre}</span>`).join(' ')}</p>
      <h3 class="mt">Ingredientes</h3>${ings}
      <h3 class="mt">Preparación</h3>
      <ol class="steps">${recipe.pasos.map((p) => `<li>${p}</li>`).join('')}</ol>`);
  });
}
