// Motor de menús: filtra por exclusiones, prioriza perfiles y genera el menú del día.
import { RECIPES, MEALS } from './data/recipes.js';
import { getState, setState, today } from './store.js';

// Grupos presentes en una receta considerando sustituciones.
function blockingGroups(recipe, exclusiones) {
  const groups = [];
  for (const ing of recipe.ingredientes) {
    if (ing.grupo && exclusiones.includes(ing.grupo)) {
      // Hay sustituto y el sustituto no está también excluido → no bloquea.
      const subOk = ing.sub && !(ing.subGrupo && exclusiones.includes(ing.subGrupo));
      if (!subOk) groups.push(ing.grupo);
    }
  }
  return groups;
}

export function isRecipeAvailable(recipe, exclusiones) {
  return blockingGroups(recipe, exclusiones).length === 0;
}

// Semáforo de la receta según los perfiles activos del usuario.
export function trafficLight(recipe, perfiles) {
  if (recipe.evitar && recipe.evitar.some((p) => perfiles.includes(p))) return 'rojo';
  if (recipe.moderar && recipe.moderar.some((p) => perfiles.includes(p))) return 'amarillo';
  return 'verde';
}

// Puntaje: cuántos perfiles del usuario cubre la receta (para priorizar).
function score(recipe, perfiles) {
  const aptos = recipe.apto.filter((p) => perfiles.includes(p)).length;
  const light = trafficLight(recipe, perfiles);
  return aptos + (light === 'verde' ? 2 : light === 'amarillo' ? 0 : -10);
}

// Recetas disponibles para una comida, ordenadas por afinidad al usuario.
export function candidatesFor(mealId) {
  const { user } = getState();
  return RECIPES
    .filter((r) => r.comida === mealId && isRecipeAvailable(r, user.exclusiones))
    .filter((r) => trafficLight(r, user.perfiles) !== 'rojo')
    .sort((a, b) => score(b, user.perfiles) - score(a, user.perfiles));
}

// Semilla determinística por fecha para variar el menú día a día.
function daySeed(dateStr) {
  let h = 0;
  for (const c of dateStr) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

// Menú del día: por comida, elige entre los mejores candidatos rotando por fecha
// y aplicando el desplazamiento manual ("cambiar receta").
export function dailyMenu(dateStr = today()) {
  const { menuOverrides } = getState();
  const seed = daySeed(dateStr);
  const menu = [];
  for (const meal of MEALS) {
    const options = candidatesFor(meal.id);
    if (!options.length) { menu.push({ meal, recipe: null }); continue; }
    const pool = options.slice(0, Math.min(4, options.length)); // rotar entre los 4 mejores
    const shift = menuOverrides[`${dateStr}|${meal.id}`] || 0;
    const idx = (seed + MEALS.indexOf(meal) + shift) % pool.length;
    menu.push({ meal, recipe: pool[idx] });
  }
  return menu;
}

export function swapMeal(mealId, dateStr = today()) {
  const key = `${dateStr}|${mealId}`;
  const { menuOverrides } = getState();
  setState({ menuOverrides: { ...menuOverrides, [key]: (menuOverrides[key] || 0) + 1 } });
}

// Nombre y emoji a mostrar para una receta: si el ingrediente que nombra el
// título está excluido (p. ej. "Tilapia al horno" cuando no se come pescado),
// se muestra el título alternativo en vez del original, no solo por dentro.
export function displayRecipe(recipe, exclusiones) {
  if (recipe.tituloSub) {
    for (const grupo of Object.keys(recipe.tituloSub)) {
      if (exclusiones.includes(grupo)) return recipe.tituloSub[grupo];
    }
  }
  return { nombre: recipe.nombre, emoji: recipe.emoji };
}

// Ingrediente a mostrar (aplica sustitución si el grupo está excluido).
export function displayIngredient(ing, exclusiones) {
  if (ing.grupo && exclusiones.includes(ing.grupo) && ing.sub) {
    return { texto: ing.sub, sustituido: true, original: ing.n };
  }
  return { texto: ing.n, sustituido: false };
}

// Lista de compras del menú del día.
export function shoppingList(dateStr = today()) {
  const { user } = getState();
  const items = [];
  for (const { recipe } of dailyMenu(dateStr)) {
    if (!recipe) continue;
    const rNombre = displayRecipe(recipe, user.exclusiones).nombre;
    for (const ing of recipe.ingredientes) {
      const d = displayIngredient(ing, user.exclusiones);
      if (!items.some((i) => i.texto === d.texto)) {
        items.push({ id: `${recipe.id}-${items.length}`, texto: d.texto, receta: rNombre });
      }
    }
  }
  return items;
}

// Snacks anti-ansiedad disponibles para el usuario.
export function sosSnacks() {
  const { user } = getState();
  return RECIPES
    .filter((r) => (r.etiquetas || []).includes('snack_antiansiedad'))
    .filter((r) => isRecipeAvailable(r, user.exclusiones))
    .filter((r) => trafficLight(r, user.perfiles) !== 'rojo')
    .sort((a, b) => score(b, user.perfiles) - score(a, user.perfiles));
}
