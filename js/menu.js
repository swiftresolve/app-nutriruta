// Motor de menús: filtra por exclusiones, prioriza perfiles y genera el menú del día.
import { RECIPES, MEALS } from './data/recipes.js';
import { PROFILES } from './data/profiles.js';
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

// Sin tildes ni mayúsculas, para que "champiñones" excluya aunque quien
// escribió el texto libre haya puesto "champinones".
const normaliza = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Exclusiones de texto libre (ej. "cilantro", "champiñones"): a diferencia
// de los grupos predefinidos, no tienen sustitución — si el nombre del
// ingrediente contiene el término, la receta queda fuera del menú.
function tieneExclusionLibre(recipe, exclusionesOtro) {
  if (!exclusionesOtro || !exclusionesOtro.length) return false;
  const terminos = exclusionesOtro.map(normaliza).filter(Boolean);
  if (!terminos.length) return false;
  return recipe.ingredientes.some((ing) => {
    const nombre = normaliza(ing.n);
    return terminos.some((t) => nombre.includes(t));
  });
}

export function isRecipeAvailable(recipe, exclusiones, exclusionesOtro) {
  return blockingGroups(recipe, exclusiones).length === 0 && !tieneExclusionLibre(recipe, exclusionesOtro);
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

// Ordena cualquier lista de recetas por afinidad al diagnóstico del usuario
// (mismo criterio que usa el menú del día) — para que el Recetario, tanto en
// lo gratis como en lo Premium, muestre primero lo más relevante para cada
// quien en vez del orden fijo en que están escritas en el archivo.
export function rankRecipes(list, perfiles) {
  return [...list].sort((a, b) => score(b, perfiles) - score(a, perfiles));
}

// Coincidencia de búsqueda por nombre o por ingrediente (sin tildes ni
// mayúsculas), para encontrar qué se puede preparar con lo que hay en casa.
export function matchesSearch(recipe, query) {
  const q = normaliza(query).trim();
  if (!q) return true;
  if (normaliza(recipe.nombre).includes(q)) return true;
  return recipe.ingredientes.some((ing) => normaliza(ing.n).includes(q));
}

// "¿Qué tienes en casa?" — busca en el catálogo REAL de recetas (nunca
// inventa ninguna), aceptando varios ingredientes separados por coma
// ("huevos, avena, banano"). Ordena primero por cuántos ingredientes de
// los que escribió realmente coinciden, y entre empates, por la misma
// afinidad al perfil que ya usa el menú del día.
export function buscarPorIngredientes(texto) {
  const { user } = getState();
  const terminos = String(texto ?? '').split(',').map((t) => normaliza(t.trim())).filter(Boolean);
  if (!terminos.length) return [];
  return RECIPES
    .filter((r) => isRecipeAvailable(r, user.exclusiones, user.exclusionesOtro))
    .filter((r) => trafficLight(r, user.perfiles) !== 'rojo')
    .map((r) => {
      const nombreN = normaliza(r.nombre);
      const ingsN = r.ingredientes.map((i) => normaliza(i.n));
      const coincidencias = terminos.filter((t) => nombreN.includes(t) || ingsN.some((i) => i.includes(t))).length;
      return { recipe: r, coincidencias };
    })
    .filter((x) => x.coincidencias > 0)
    .sort((a, b) => b.coincidencias - a.coincidencias || score(b.recipe, user.perfiles) - score(a.recipe, user.perfiles))
    .map((x) => x.recipe);
}

// Recetas disponibles para una comida, ordenadas por afinidad al usuario.
export function candidatesFor(mealId) {
  const { user } = getState();
  return RECIPES
    .filter((r) => r.comida === mealId && isRecipeAvailable(r, user.exclusiones, user.exclusionesOtro))
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

// Sin targetIndex: rota a la siguiente opción (comportamiento anterior).
// Con targetIndex: salta directo a una alternativa específica elegida en
// el modal de sustitución — se calcula el shift necesario para que la
// misma fórmula de dailyMenu() aterrice exactamente en ese índice.
export function swapMeal(mealId, dateStr = today(), targetIndex = null) {
  const key = `${dateStr}|${mealId}`;
  const { menuOverrides } = getState();
  if (targetIndex === null) {
    setState({ menuOverrides: { ...menuOverrides, [key]: (menuOverrides[key] || 0) + 1 } });
    return;
  }
  const options = candidatesFor(mealId);
  const pool = options.slice(0, Math.min(4, options.length));
  if (!pool.length) return;
  const seed = daySeed(dateStr);
  const mealIdx = MEALS.findIndex((m) => m.id === mealId);
  const shift = ((targetIndex - seed - mealIdx) % pool.length + pool.length) % pool.length;
  setState({ menuOverrides: { ...menuOverrides, [key]: shift } });
}

// Motivo real (no inventado) de por qué una receta encaja: perfiles de
// salud que sí cubre, tomados directo de recipe.apto — nunca un texto
// genérico de marketing.
function motivoCompat(recipe, perfiles) {
  const coincide = (recipe.apto || []).filter((p) => perfiles.includes(p));
  if (coincide.length) {
    const nombres = coincide.slice(0, 2).map((p) => PROFILES[p]?.nombre || p);
    return `Buena opción para ${nombres.join(' y ')}.`;
  }
  return 'Dentro de tus preferencias y exclusiones actuales.';
}

// Alternativas reales para sustituir una comida: la opción actual + hasta
// 3 alternativas del mismo pool que ya usa dailyMenu() (mismo filtro por
// perfil/exclusiones/alergias), cada una con un motivo real de por qué
// encaja — no elige solo por rotación silenciosa como antes.
export function alternativesFor(mealId, dateStr = today()) {
  const { user } = getState();
  const options = candidatesFor(mealId);
  if (!options.length) return { current: null, currentIndex: -1, alternatives: [] };
  const pool = options.slice(0, Math.min(4, options.length));
  const seed = daySeed(dateStr);
  const mealIdx = MEALS.findIndex((m) => m.id === mealId);
  const { menuOverrides } = getState();
  const shift = menuOverrides[`${dateStr}|${mealId}`] || 0;
  const currentIndex = (seed + mealIdx + shift) % pool.length;
  const alternatives = pool
    .map((recipe, index) => ({ recipe, index, motivo: motivoCompat(recipe, user.perfiles) }))
    .filter((a) => a.index !== currentIndex);
  return { current: pool[currentIndex], currentIndex, alternatives };
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

// Categoría de compra de un ingrediente — agrupación puramente visual para
// hacer la lista más fácil de recorrer en el súper (fruta, verdura, etc.),
// nunca una clasificación nutricional ni médica. Por keyword sobre el
// nombre real del ingrediente (no hay ese dato en recipes.js todavía);
// "Otros" es el fallback honesto para lo que no reconoce, no se fuerza
// una categoría incorrecta.
const CATEGORIAS_COMPRA = [
  ['Frutas', ['banano', 'plátano', 'manzana', 'fresa', 'arándano', 'mora', 'kiwi', 'mandarina', 'naranja', 'pera', 'uva', 'durazno', 'ciruela', 'dátil', 'limón', 'limon', 'coco', 'aguacate']],
  ['Verduras', ['espinaca', 'brócoli', 'brocoli', 'calabacín', 'calabacin', 'zanahoria', 'tomate', 'pepino', 'lechuga', 'apio', 'coliflor', 'cebolla', 'pimentón', 'pimenton', 'ahuyama', 'berenjena', 'champiñon', 'champiñón', 'col morada', 'habichuela', 'ajo', 'jengibre', 'batata', 'papa']],
  ['Proteínas', ['pollo', 'pechuga', 'pavo', 'carne', 'atún', 'atun', 'pescado', 'salmón', 'salmon', 'tilapia', 'trucha', 'camarones', 'huevo', 'tofu', 'edamame', 'garbanzo', 'lenteja', 'arveja']],
  ['Granos', ['avena', 'arroz', 'pasta', 'pan integral', 'pan ', 'tortilla', 'arepa', 'quinoa', 'maíz', 'maiz', 'tostada']],
  ['Lácteos', ['yogur', 'queso', 'leche', 'kéfir', 'kefir', 'requesón', 'requeson', 'cottage']],
];

// No basta con "la primera categoría que matchea" en orden fijo: frases
// como "lentejas guisadas con tomate y zanahoria" contienen keywords de
// varias categorías a la vez. Se usa la que aparece MÁS TEMPRANO en el
// texto — el ingrediente principal casi siempre se nombra primero, lo
// demás son acompañantes mencionados después.
export function categoriaIngrediente(texto) {
  const n = normaliza(texto);
  let mejor = null;
  let mejorPos = Infinity;
  for (const [categoria, keywords] of CATEGORIAS_COMPRA) {
    for (const k of keywords) {
      const pos = n.indexOf(normaliza(k));
      if (pos !== -1 && pos < mejorPos) { mejorPos = pos; mejor = categoria; }
    }
  }
  return mejor || 'Otros';
}

// Agrupa una lista de items de compra ({texto, ...}) por categoría, en un
// orden fijo pensado para recorrer el súper por pasillo — "Otros" siempre
// al final.
const ORDEN_CATEGORIAS = ['Frutas', 'Verduras', 'Proteínas', 'Granos', 'Lácteos', 'Otros'];
export function agruparPorCategoria(items) {
  const grupos = new Map(ORDEN_CATEGORIAS.map((c) => [c, []]));
  for (const item of items) {
    const cat = categoriaIngrediente(item.texto);
    grupos.get(cat).push(item);
  }
  return ORDEN_CATEGORIAS.map((cat) => ({ categoria: cat, items: grupos.get(cat) })).filter((g) => g.items.length);
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

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// Suma "n" días a una fecha YYYY-MM-DD usando componentes locales (no UTC):
// como aquí solo movemos una fecha de calendario, no un instante, no hay
// riesgo de los líos de zona horaria que sí aplican a today().
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Lista de compras proyectada a varios días: como el menú es determinístico
// por fecha (misma semilla + overrides guardados), se puede calcular el menú
// de cualquier día futuro sin que la usuaria tenga que "visitarlo" primero.
// Como las recetas no tienen cantidades, no inventamos números — en vez de
// eso mostramos en cuántos días/recetas aparece cada ingrediente, para que
// la usuaria calcule el volumen con ese criterio real.
export function rangeShoppingList(days, startDate = today()) {
  const { user } = getState();
  const map = new Map();
  for (let i = 0; i < days; i++) {
    const dateStr = addDays(startDate, i);
    const weekday = DIAS_CORTOS[new Date(dateStr + 'T00:00:00').getDay()];
    for (const { recipe } of dailyMenu(dateStr)) {
      if (!recipe) continue;
      for (const ing of recipe.ingredientes) {
        const d = displayIngredient(ing, user.exclusiones);
        if (!map.has(d.texto)) map.set(d.texto, { texto: d.texto, count: 0, dias: [] });
        const entry = map.get(d.texto);
        entry.count += 1;
        entry.dias.push(weekday);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

// Snacks anti-ansiedad disponibles para el usuario.
export function sosSnacks() {
  const { user } = getState();
  return RECIPES
    .filter((r) => (r.etiquetas || []).includes('snack_antiansiedad'))
    .filter((r) => isRecipeAvailable(r, user.exclusiones, user.exclusionesOtro))
    .filter((r) => trafficLight(r, user.perfiles) !== 'rojo')
    .sort((a, b) => score(b, user.perfiles) - score(a, user.perfiles));
}
