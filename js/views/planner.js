// Recetario + lista de compras.
import { getState, setState, isPremium } from '../store.js';
import { RECIPES, MEALS } from '../data/recipes.js';
import { isRecipeAvailable, trafficLight, shoppingList, rangeShoppingList, displayRecipe, rankRecipes, matchesSearch } from '../menu.js';
import { header, navigate } from '../app.js';
import { openRecipe } from './dashboard.js';

// Recetas visibles en el plan gratuito (el resto se muestra bloqueado).
const FREE_RECIPE_LIMIT = 12;

// Traducción de las etiquetas reales de cada receta (data/recipes.js) a un
// chip corto y amigable — no inventa datos, solo los presenta mejor.
const TAG_LABELS = {
  alto_proteina: '💪 Proteína', bajo_azucar: '🚫🍬 Bajo azúcar', alto_fibra: '🌾 Alta fibra',
  fibra_soluble: '🌾 Fibra soluble', grasa_saludable: '🥑 Grasa buena', rapido: '⚡ Rápido',
  sin_gluten: '🌾✕ Sin gluten', local: '📍 Local', fermentado: '🫙 Fermentado',
  microbiota: '🦠 Microbiota', antojo_dulce_saludable: '🍯 Antojo sano', snack_antiansiedad: '🧘 Antiansiedad',
  proteina_vegetal: '🌱 Prot. vegetal', omega3: '🐟 Omega 3', plato_modelo: '🍽️ Plato modelo',
  economico: '💰 Económico', bajo_ig: '📉 Bajo IG', mediterraneo: '🫒 Mediterráneo',
  suave: '🍃 Suave', colon_friendly: '💚 Colon feliz', vegano: '🌱 Vegano', hidratante: '💧 Hidratante',
  reemplaza_paquetes: '🚫🍪 Sin paquete', reemplaza_alcohol: '🚫🍷 Sin alcohol', ligero: '🪶 Ligero',
  antojo_salado_saludable: '🧂 Antojo sano'
};
const HOT_MEALS = new Set(['desayuno', 'almuerzo', 'cena']);

export function renderPlanner(container, params = {}) {
  header(container);
  let tab = params.tab || 'recetas';
  let mealFilter = 'todas';
  let rango = 'hoy';
  let busqueda = '';

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

  // Redibujar en cada tecla borra y recrea el input — sin esto el cursor
  // "salta" al inicio y se pierde el foco en cada letra escrita.
  function searchAfterDraw() {
    const input = body.querySelector('#recetas-buscar');
    if (!input) return;
    input.focus();
    const pos = input.value.length;
    input.setSelectionRange(pos, pos);
  }

  function drawRecipes() {
    const { user } = getState();

    const search = document.createElement('div');
    search.className = 'mb';
    search.innerHTML = `
      <input id="recetas-buscar" type="search" inputmode="search" placeholder="🔍 Buscar por nombre o ingrediente (ej: pollo, avena)"
        style="width:100%;padding:12px 14px;border-radius:14px;border:1.5px solid #D8E6E2;font:inherit;box-sizing:border-box">`;
    const searchInput = search.querySelector('#recetas-buscar');
    searchInput.value = busqueda;
    searchInput.addEventListener('input', (e) => { busqueda = e.target.value; drawBody(); searchAfterDraw(); });
    body.appendChild(search);

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

    let list = RECIPES
      .filter((r) => mealFilter === 'todas' || r.comida === mealFilter)
      .filter((r) => isRecipeAvailable(r, user.exclusiones, user.exclusionesOtro))
      .filter((r) => matchesSearch(r, busqueda));
    // Primero lo más afín a tu diagnóstico (mismo criterio que arma el menú
    // del día) — así lo gratis y lo que aparece primero al explorar es lo
    // más relevante para ti, no un orden fijo del archivo.
    list = rankRecipes(list, user.perfiles);

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'card';
      empty.innerHTML = `<p>${busqueda ? `No encontramos recetas con "${busqueda}".` : 'No hay recetas disponibles con tus exclusiones actuales en esta categoría.'}</p>`;
      body.appendChild(empty);
    }
    const grid = document.createElement('div');
    grid.className = 'recipe-grid';
    const premium = isPremium();
    const meal = MEALS.reduce((m, x) => (m[x.id] = x, m), {});
    list.forEach((r, i) => {
      const locked = !premium && i >= FREE_RECIPE_LIMIT;
      const light = trafficLight(r, user.perfiles);
      const shown = displayRecipe(r, user.exclusiones);
      const tags = (r.etiquetas || []).slice(0, 2).map((t) => `<span class="recipe-tag">${TAG_LABELS[t] || t}</span>`).join('');
      const item = document.createElement('button');
      item.className = 'recipe-card' + (locked ? ' locked' : '');
      item.innerHTML = `
        <div class="recipe-plate">
          ${HOT_MEALS.has(r.comida) ? '<span class="steam"><span></span><span></span><span></span></span>' : ''}
          ${shown.emoji}
          <span class="garnish">${meal[r.comida]?.emoji || ''}</span>
          ${locked ? '' : `<span class="semaforo-ring ${light}" title="Semáforo: ${light}"></span>`}
        </div>
        <div class="recipe-title">${shown.nombre}</div>
        <div class="recipe-desc${locked ? ' lesson-blur' : ''}">${r.descripcion}</div>
        ${locked ? '<div class="recipe-lock">🔒 Premium</div>' : `<div class="recipe-tags">${tags}</div>`}`;
      item.addEventListener('click', () => locked ? navigate('plans') : openRecipe(r));
      grid.appendChild(item);
    });
    body.appendChild(grid);

    const note = document.createElement('p');
    note.className = 'muted small center mt';
    note.textContent = 'El semáforo se calcula según tus perfiles activos: verde = recomendado, amarillo = con moderación.';
    body.appendChild(note);
  }

  function drawShopping() {
    if (!isPremium()) {
      const upsell = document.createElement('div');
      upsell.className = 'card center';
      upsell.innerHTML = `
        <div style="font-size:2.4rem">🛒</div>
        <h2>Lista de compras automática</h2>
        <p class="mt">Genera tu lista de mercado a partir de tu menú del día, con sustituciones incluidas. Es parte del <strong>plan Premium</strong>.</p>
        <button class="btn accent full mt">Ver planes Premium</button>`;
      upsell.querySelector('.btn').addEventListener('click', () => navigate('plans'));
      body.appendChild(upsell);
      return;
    }
    const rangos = document.createElement('div');
    rangos.className = 'chips mb';
    for (const [id, label] of [['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes']]) {
      const b = document.createElement('button');
      b.className = 'chip small' + (rango === id ? ' selected' : '');
      b.textContent = label;
      b.addEventListener('click', () => { rango = id; drawBody(); });
      rangos.appendChild(b);
    }
    body.appendChild(rangos);

    const { compras } = getState();
    const card = document.createElement('div');
    card.className = 'card';

    if (rango === 'hoy') {
      const items = shoppingList();
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
    } else {
      const dias = rango === 'semana' ? 7 : 30;
      const items = rangeShoppingList(dias);
      card.innerHTML = `<h2>🛒 Compras para ${rango === 'semana' ? 'esta semana' : 'este mes'}</h2>
        <p class="small mb">Proyectada desde tu menú de los próximos ${dias} días. No sabemos cantidades exactas por receta, así que te mostramos en cuántos días aparece cada cosa — úsalo como guía de cuánto comprar.</p>`;
      for (const it of items) {
        const row = document.createElement('div');
        const done = !!compras[it.texto];
        row.className = 'shop-item' + (done ? ' done' : '');
        const diasTexto = [...new Set(it.dias)].slice(0, 6).join(', ');
        row.innerHTML = `<input type="checkbox" ${done ? 'checked' : ''} id="s-r-${it.texto}">
          <span>${it.texto} <span class="muted small">· ${it.count}× (${diasTexto})</span></span>`;
        row.querySelector('input').addEventListener('change', (e) => {
          setState({ compras: { ...getState().compras, [it.texto]: e.target.checked } });
          row.classList.toggle('done', e.target.checked);
        });
        card.appendChild(row);
      }
    }
    body.appendChild(card);
  }

  drawTabs();
  drawBody();
  container.appendChild(tabs);
  container.appendChild(body);
}
