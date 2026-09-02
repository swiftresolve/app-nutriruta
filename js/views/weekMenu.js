// Vista de la semana completa del menú — la misma lógica determinística
// de dailyMenu() (ver menu.js), solo que proyectada 7 días hacia adelante
// en vez de mostrar únicamente el día de hoy. No es un motor nuevo, es
// exponer datos que ya existían (rangeShoppingList ya proyectaba varios
// días para la lista de compras).
import { getState } from '../store.js';
import { dailyMenu, displayRecipe } from '../menu.js';
import { header, navigate } from '../app.js';
import { openRecipe } from './dashboard.js';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function todayStr() {
  const dt = new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function renderWeekMenu(container) {
  header(container);
  const { user } = getState();

  const back = document.createElement('button');
  back.className = 'link-btn small';
  back.textContent = '← Volver';
  back.addEventListener('click', () => navigate('dashboard'));
  container.appendChild(back);

  const titulo = document.createElement('div');
  titulo.className = 'card center';
  titulo.innerHTML = '<h2>📅 Tu semana</h2><p class="small muted mt">Lo que tu Ruta te sugiere para los próximos 7 días.</p>';
  container.appendChild(titulo);

  const hoy = todayStr();
  for (let i = 0; i < 7; i++) {
    const fecha = addDays(hoy, i);
    const dow = new Date(fecha + 'T00:00:00').getDay();
    const menu = dailyMenu(fecha);
    const dia = document.createElement('div');
    dia.className = 'card';
    dia.innerHTML = `<h3>${i === 0 ? 'Hoy · ' : ''}${DIAS[dow]}</h3>`;
    for (const { meal, recipe } of menu) {
      if (!recipe) continue;
      const shown = displayRecipe(recipe, user.exclusiones);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'habit';
      row.style.width = '100%';
      row.style.textAlign = 'left';
      row.innerHTML = `<label>${meal.emoji} ${meal.nombre}</label><span class="small muted">${shown.emoji} ${shown.nombre}</span>`;
      row.addEventListener('click', () => openRecipe(recipe));
      dia.appendChild(row);
    }
    container.appendChild(dia);
  }
}
