// Recetario + lista de compras.
import { getState, setState } from '../store.js';
import { RECIPES, MEALS } from '../data/recipes.js';
import { PROFILES } from '../data/profiles.js';
import { isRecipeAvailable, trafficLight, shoppingList } from '../menu.js';
import { header } from '../app.js';
import { openRecipe } from './dashboard.js';

export function renderPlanner(container, params = {}) {
  header(container);
  let tab = params.tab || 'recetas';
  let mealFilter = 'todas';

  const tabs = document.createElement('div');
  tabs.className = 'chips mb';
  const body = document.createElement('div');

  function drawTabs() {
    tabs.innerHTML = '';
    for (const [id, label] of [['recetas', '🥗 Recetario'], ['compras', '🛒 Lista de compras']]) {
      const b = document.createElement('button');
      b.className = 'chip' + (tab === id ? ' selected' : '');
      b.textContent = label;
      b.addEventListener('click', () => { tab = id; drawTabs(); drawBody(); });
      tabs.appendChild(b);
    }
  }

  function drawBody() {
    body.innerHTML = '';
    tab === 'recetas' ? drawRecipes() : drawShopping();
  }

  function drawRecipes() {
    const { user } = getState();

    const filters = document.createElement('div');
    filters.className = 'chips mb';
    const opts = [{ id: 'todas', nombre: 'Todas', emoji: '✨' }, ...MEALS];
    for (const o of opts) {
      const b = document.createElement('button');
      b.className = 'chip small' + (mealFilter === o.id ? ' selected' : '');
      b.textContent = `${o.emoji} ${o.nombre}`;
      b.addEventListener('click', () => { mealFilter = o.id; drawBody(); });
      filters.appendChild(b);
    }
    body.appendChild(filters);

    const card = document.createElement('div');
    card.className = 'card';
    const list = RECIPES
      .filter((r) => mealFilter === 'todas' || r.comida === mealFilter)
      .filter((r) => isRecipeAvailable(r, user.exclusiones));

    if (!list.length) {
      card.innerHTML = '<p>No hay recetas disponibles con tus exclusiones actuales en esta categoría.</p>';
    }
    for (const r of list) {
      const light = trafficLight(r, user.perfiles);
      const item = document.createElement('button');
      item.className = 'recipe-item';
      item.innerHTML = `
        <span class="recipe-emoji">${r.emoji}</span>
        <span class="info">
          <strong>${r.nombre}</strong><br>
          <span class="muted small">${r.descripcion}</span>
        </span>
        <span class="dot ${light}" title="Semáforo: ${light}"></span>`;
      item.addEventListener('click', () => openRecipe(r));
      card.appendChild(item);
    }
    body.appendChild(card);

    const note = document.createElement('p');
    note.className = 'muted small center mt';
    note.textContent = 'El semáforo se calcula según tus perfiles activos: verde = recomendado, amarillo = con moderación.';
    body.appendChild(note);
  }

  function drawShopping() {
    const { compras } = getState();
    const items = shoppingList();
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2>🛒 Compras para tu menú de hoy</h2><p class="small mb">Generada automáticamente desde tu menú del día.</p>';
    for (const it of items) {
      const row = document.createElement('div');
      const done = !!compras[it.texto];
      row.className = 'shop-item' + (done ? ' done' : '');
      row.innerHTML = `<input type="checkbox" ${done ? 'checked' : ''} id="s-${it.id}"><span>${it.texto}</span>`;
      row.querySelector('input').addEventListener('change', (e) => {
        setState({ compras: { ...getState().compras, [it.texto]: e.target.checked } });
        row.classList.toggle('done', e.target.checked);
      });
      card.appendChild(row);
    }
    body.appendChild(card);
  }

  drawTabs();
  drawBody();
  container.appendChild(tabs);
  container.appendChild(body);
}
