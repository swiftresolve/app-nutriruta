// Dashboard diario: menú del día, agua, hábitos y acceso rápido al SOS.
import { getState, getWater, setWater, getHabits, toggleHabit, cravingPattern, checkAchievements, esc, isPremium } from '../store.js';
import { MISSION } from '../data/mission.js';
import { PROFILES } from '../data/profiles.js';
import { dailyMenu, swapMeal, trafficLight, displayIngredient } from '../menu.js';
import { navigate, header, openModal, toast } from '../app.js';

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

  // --- Aviso de patrón de antojos (mini IA local) ---
  const patron = cravingPattern();
  if (patron) {
    const tip = document.createElement('div');
    tip.className = 'card';
    tip.style.borderLeft = '4px solid var(--accent)';
    tip.innerHTML = `<p class="small">💡 <strong>Hemos notado</strong> que tus antojos suelen aparecer en la <strong>${patron}</strong>. Prepara con anticipación un snack saludable para ese momento.</p>`;
    container.appendChild(tip);
  }

  // --- Misión 12 semanas ---
  const { mision } = getState();
  const misionCard = document.createElement('div');
  misionCard.className = 'card';
  misionCard.style.borderLeft = '4px solid var(--primary)';
  if (mision && mision.inicio) {
    const done = (mision.completadas || []).length;
    misionCard.innerHTML = `
      <div class="spread"><h3>🎯 Misión 12 semanas</h3><span class="tag verde">${done}/12</span></div>
      <div class="quiz-progress mt" style="margin-bottom:6px"><div style="width:${Math.round((done / 12) * 100)}%"></div></div>
      <button class="link-btn small">Continuar mi misión →</button>`;
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

  // --- Menú del día ---
  const menuCard = document.createElement('div');
  menuCard.className = 'card';
  menuCard.innerHTML = '<div class="spread"><h2>🍽️ Tu menú de hoy</h2></div>';
  for (const { meal, recipe } of dailyMenu()) {
    const m = document.createElement('div');
    m.className = 'meal';
    if (!recipe) {
      m.innerHTML = `<div class="meal-name">${meal.emoji} ${meal.nombre}</div><p class="small">Sin opciones con tus exclusiones actuales. Revisa Ajustes.</p>`;
    } else {
      const light = trafficLight(recipe, getState().user.perfiles);
      m.innerHTML = `
        <div class="meal-name">${meal.emoji} ${meal.nombre}</div>
        <div class="spread">
          <button class="link-btn" style="text-align:left">${recipe.emoji} ${recipe.nombre}</button>
          <span class="row"><span class="dot ${light}"></span>
            <button class="icon-btn" title="Cambiar receta" aria-label="Cambiar receta">🔄</button></span>
        </div>`;
      m.querySelector('.link-btn').addEventListener('click', () => openRecipe(recipe));
      m.querySelector('.icon-btn').addEventListener('click', () => {
        swapMeal(meal.id);
        renderDashboard(clearAndGet(container));
      });
    }
    menuCard.appendChild(m);
  }
  const shopBtn = document.createElement('button');
  shopBtn.className = 'btn ghost sm mt';
  shopBtn.textContent = '🛒 Ver lista de compras';
  shopBtn.addEventListener('click', () => navigate('planner', { tab: 'compras' }));
  menuCard.appendChild(shopBtn);
  container.appendChild(menuCard);

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
      toggleHabit(h.id);
      const nuevos = checkAchievements();
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
    const ings = recipe.ingredientes.map((ing) => {
      const d = displayIngredient(ing, user.exclusiones);
      return `<div class="ingredient">• ${d.texto}${d.sustituido ? ` <span class="sub-note">(sustituto de ${d.original})</span>` : ''}</div>`;
    }).join('');
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2.4rem">${recipe.emoji}</div>
      <h2>${recipe.nombre}</h2>
      <p class="small">${recipe.descripcion}</p>
      <p class="mt"><span class="tag ${light}">Semáforo: ${light}</span>
        ${recipe.apto.filter((p) => user.perfiles.includes(p)).map((p) => `<span class="tag perfil">${PROFILES[p].nombre}</span>`).join(' ')}</p>
      <h3 class="mt">Ingredientes</h3>${ings}
      <h3 class="mt">Preparación</h3>
      <ol class="steps">${recipe.pasos.map((p) => `<li>${p}</li>`).join('')}</ol>`);
  });
}
