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

// Semáforo para recetas PROPIAS (creadas por la usuaria, con IA o a mano)
// -- no tienen el "evitar"/"moderar" curado a mano del catálogo (son
// ingredientes en texto libre), así que se revisan contra las mismas
// palabras clave que ya aparecen en las "claves" ya redactadas y
// aprobadas de cada perfil (profiles.js), nunca contra un criterio nuevo
// inventado aquí. Nivel "evitar" solo en los perfiles cuyas claves dicen
// literalmente "Evitar..."; el resto son "moderar" (reducir/menos/
// sustituir), igual que en el catálogo. Detecta negaciones simples ("sin
// azúcar", "bajo en sodio") para no marcar en rojo justo lo que sí evita
// el ingrediente problemático.
const PERFIL_PALABRAS_PROPIAS = {
  higado_graso: { evitar: ['frito', 'fritos', 'frita', 'fritas', 'azúcar', 'azucar', 'harina refinada', 'harinas refinadas', 'alcohol', 'cerveza', 'vino', 'licor'] },
  candidiasis: { evitar: ['azúcar', 'azucar', 'levadura', 'alcohol', 'harina refinada', 'harinas refinadas', 'pan blanco'] },
  resistencia_insulina: { moderar: ['harina refinada', 'pan blanco', 'arroz blanco', 'azúcar', 'azucar', 'refresco', 'gaseosa', 'jugo de fruta', 'bebida azucarada'] },
  prediabetes: { moderar: ['azúcar', 'azucar', 'grasa saturada', 'manteca', 'mantequilla', 'tocineta', 'tocino', 'embutido'] },
  colon_irritable: { moderar: ['cebolla', 'ajo', 'frijol', 'frijoles', 'lenteja', 'lentejas', 'garbanzo', 'garbanzos', 'sorbitol', 'xilitol'] },
  migranas: { moderar: ['cafeína', 'cafeina', 'café', 'cafe', 'alcohol', 'vino', 'glutamato', 'queso curado', 'queso añejo', 'queso maduro'] },
  colesterol: { moderar: ['grasa saturada', 'manteca', 'mantequilla', 'tocineta', 'tocino', 'embutido', 'frito', 'fritos', 'piel de pollo'] },
  gases: { moderar: ['brócoli', 'brocoli', 'coliflor', 'repollo', 'cebolla', 'ajo', 'frijol', 'frijoles'] }
};
// "mantequilla de maní" es sana (grasa vegetal), no la mantequilla animal
// que sí preocupa en colesterol/prediabetes -- falso positivo real que ya
// se detectó auditando el catálogo, se evita igual acá.
const EXCEPCIONES_PALABRA = { mantequilla: ['mantequilla de maní', 'mantequilla de mani', 'mantequilla de almendra'] };
const NEGACIONES = ['sin ', 'bajo en ', 'baja en ', 'libre de ', '0% ', 'light '];

function palabraAparece(texto, palabra) {
  let idx = texto.indexOf(palabra);
  while (idx !== -1) {
    const excepciones = EXCEPCIONES_PALABRA[palabra] || [];
    const esExcepcion = excepciones.some((exc) => texto.startsWith(exc, idx) || texto.includes(exc));
    const antes = texto.slice(Math.max(0, idx - 12), idx);
    const esNegada = NEGACIONES.some((n) => antes.endsWith(n.trim() + ' ') || antes.endsWith(n));
    if (!esExcepcion && !esNegada) return true;
    idx = texto.indexOf(palabra, idx + 1);
  }
  return false;
}

export function trafficLightRecetaPropia(receta, perfiles) {
  const texto = normaliza(`${(receta.ingredientes || []).join(' ')} ${receta.descripcion || ''}`);
  let huboAmarillo = false;
  for (const perfilId of perfiles) {
    const reglas = PERFIL_PALABRAS_PROPIAS[perfilId];
    if (!reglas) continue;
    if ((reglas.evitar || []).some((p) => palabraAparece(texto, normaliza(p)))) return 'rojo';
    if ((reglas.moderar || []).some((p) => palabraAparece(texto, normaliza(p)))) huboAmarillo = true;
  }
  return huboAmarillo ? 'amarillo' : 'verde';
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
// Si tiene perfiles de salud activos, prioriza SOLO las que de verdad
// ayudan a esa condición (recipe.apto) en vez de cualquiera que no esté
// en rojo -- antes "no rojo" dejaba pasar recetas neutras (sin etiquetar
// para su perfil) junto a las realmente indicadas, sin distinguirlas.
// Si el catálogo no alcanza 4 para esa comida+perfil, se completa con el
// resto (nunca deja una comida sin sugerencia). Usada también por
// dailyMenu()/alternativesFor()/swapMeal() -- cambiarla aquí, en la raíz,
// mantiene el menú del día y el botón de "cambiar comida" consistentes
// entre sí (ambos rotan sobre el mismo pool).
export function candidatesFor(mealId) {
  const { user } = getState();
  const perfiles = user.perfiles || [];
  const disponibles = RECIPES
    .filter((r) => r.comida === mealId && isRecipeAvailable(r, user.exclusiones, user.exclusionesOtro))
    .filter((r) => trafficLight(r, perfiles) !== 'rojo');

  if (perfiles.length) {
    const queAyudan = disponibles.filter((r) => (r.apto || []).some((p) => perfiles.includes(p)));
    if (queAyudan.length >= 4) return queAyudan.sort((a, b) => score(b, perfiles) - score(a, perfiles));
  }
  return disponibles.sort((a, b) => score(b, perfiles) - score(a, perfiles));
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
  const { menuOverrides, user } = getState();
  const seed = daySeed(dateStr);
  const menu = [];
  for (const meal of mealsActivas(user)) {
    const options = candidatesFor(meal.id);
    if (!options.length) { menu.push({ meal, recipe: null }); continue; }
    const pool = options.slice(0, Math.min(4, options.length)); // rotar entre los 4 mejores
    const shift = menuOverrides[`${dateStr}|${meal.id}`] || 0;
    const idx = (seed + MEALS.indexOf(meal) + shift) % pool.length;
    menu.push({ meal, recipe: pool[idx] });
  }
  return menu;
}

// Comidas que la usuaria eligió incluir en su día (quiz "¿Qué comidas
// quieres incluir?", editable después en Ajustes) -- por defecto las 5,
// para no romper cuentas creadas antes de que existiera esta opción
// (comidasActivas quedaría undefined, nunca debe leerse como "todas
// apagadas"). Exportada porque dashboard.js necesita esta misma lista
// (no solo el menú ya filtrado) para alinear las horas de inicio con
// cada fila que sí se muestra.
export function mealsActivas(user) {
  const activas = user?.comidasActivas;
  return MEALS.filter((m) => !activas || activas[m.id] !== false);
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
    return { texto: ing.sub, sustituido: true, original: ing.n, cantidad: null, resto: null };
  }
  // cantidad/resto vienen de recipes.js (número + el texto sin ese número,
  // ej. "1 taza de espinaca" -> cantidad:1, resto:"taza de espinaca") --
  // permiten sumar cantidades reales en la lista de compras proyectada en
  // vez de solo contar apariciones. No todos los ingredientes lo tienen
  // (ej. "Canela al gusto" no tiene una cantidad real que sumar).
  return { texto: ing.n, sustituido: false, cantidad: ing.cantidad ?? null, resto: ing.resto ?? null };
}

// Conversión métrico → imperial (Ajustes → Unidades). Solo convierte
// unidades de medida reales (peso/volumen); un conteo de piezas ("2
// huevos", "6 tomates cherry") no tiene unidad que convertir, se muestra
// igual en ambos sistemas. Las de cocina (taza/cda/cdta/vaso) son tan
// cercanas a su equivalente real (240/15/5 ml vs. 1 cup/tbsp/tsp de EE.UU.)
// que solo se traduce la palabra, sin tocar el número — convertir eso a
// decimales sería más impreciso, no más exacto.
const UNIDADES_A_IMPERIAL = {
  g: { factor: 0.035274, etiqueta: 'oz' },
  gramos: { factor: 0.035274, etiqueta: 'oz' },
  kg: { factor: 2.20462, etiqueta: 'lb' },
  ml: { factor: 0.033814, etiqueta: 'fl oz' },
  l: { factor: 33.814, etiqueta: 'fl oz' },
  litro: { factor: 33.814, etiqueta: 'fl oz' },
  taza: { factor: 1, etiqueta: 'cup' },
  tazas: { factor: 1, etiqueta: 'cups' },
  cda: { factor: 1, etiqueta: 'tbsp' },
  cdas: { factor: 1, etiqueta: 'tbsp' },
  cdta: { factor: 1, etiqueta: 'tsp' },
  cdtas: { factor: 1, etiqueta: 'tsp' },
  vaso: { factor: 1, etiqueta: 'cup' },
  vasos: { factor: 1, etiqueta: 'cups' }
};

// Arma el texto final de una cantidad+resto (ver displayIngredient/
// rangeShoppingList) según el sistema de unidades elegido. Si no hay
// cantidad/resto estructurados (ej. "Canela al gusto"), o el primer
// token de `resto` no es una unidad reconocida (ej. "huevos", cuenta de
// piezas), devuelve el texto sin tocar — nunca inventa una conversión
// sobre algo que no es una medida real.
export function textoConCantidad(cantidad, resto, sistema = 'metrico') {
  const base = `${formatCantidad(cantidad)} ${resto}`;
  if (sistema !== 'imperial') return base;
  const espacio = resto.indexOf(' ');
  const primera = (espacio === -1 ? resto : resto.slice(0, espacio)).toLowerCase();
  const conv = UNIDADES_A_IMPERIAL[primera];
  if (!conv) return base;
  const restoDescripcion = espacio === -1 ? '' : resto.slice(espacio);
  return `${formatCantidad(cantidad * conv.factor)} ${conv.etiqueta}${restoDescripcion}`;
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
// Cuando el ingrediente trae cantidad/resto reales (recipes.js), se suman
// de verdad (ej. "2 huevos" + "1 huevo" -> "3 huevos"); si no los trae (ej.
// "Canela al gusto"), no se inventa un número — se sigue mostrando en
// cuántos días/recetas aparece, como antes.
// Se agrupa por `resto` cuando existe (en vez de por el texto completo)
// para que variantes con distinta cantidad del mismo ingrediente ("1 huevo"
// vs "2 huevos") se fusionen en un solo renglón en vez de listarse aparte.
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
        const key = d.resto || d.texto;
        if (!map.has(key)) map.set(key, { texto: d.texto, resto: d.resto, cantidadTotal: 0, count: 0, dias: [] });
        const entry = map.get(key);
        entry.count += 1;
        entry.dias.push(weekday);
        if (d.cantidad != null) entry.cantidadTotal += d.cantidad;
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

// Formatea una cantidad sumada para mostrar ("3", "3.5", nunca "3.500000004").
export function formatCantidad(n) {
  return String(Math.round(n * 100) / 100);
}

// Snacks anti-ansiedad disponibles para el usuario.
// Mismo criterio que candidatesFor: si hay perfiles de salud activos,
// prioriza solo los snacks que de verdad ayudan a esa condición (apto),
// completando con el resto si el catálogo no alcanza -- antes "no rojo"
// dejaba pasar snacks neutros junto a los realmente indicados.
export function sosSnacks() {
  const { user } = getState();
  const perfiles = user.perfiles || [];
  const disponibles = RECIPES
    .filter((r) => (r.etiquetas || []).includes('snack_antiansiedad'))
    .filter((r) => isRecipeAvailable(r, user.exclusiones, user.exclusionesOtro))
    .filter((r) => trafficLight(r, perfiles) !== 'rojo');

  if (perfiles.length) {
    const queAyudan = disponibles.filter((r) => (r.apto || []).some((p) => perfiles.includes(p)));
    if (queAyudan.length >= 4) return queAyudan.sort((a, b) => score(b, perfiles) - score(a, perfiles));
  }
  return disponibles.sort((a, b) => score(b, perfiles) - score(a, perfiles));
}
