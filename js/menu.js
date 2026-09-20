// Motor de menús: filtra por exclusiones, prioriza perfiles y muestra el
// menú del día.
//
// El catálogo completo de recetas (ingredientes/pasos de las 105 recetas)
// YA NO vive en el navegador -- antes este archivo importaba RECIPES
// entero desde data/recipes.js y cualquier visitante podía leerlo por "Ver
// código fuente", pagando o no. Ahora todo lo que necesita el catálogo
// completo (menú del día, cambiar receta, sugerencias por etiqueta,
// búsqueda por ingrediente) pasa por RPCs/una Edge Function en Supabase
// (ver supabase-client.js: resolverMenu/resolverPorEtiquetas/
// buscarPorIngrediente/fetchRecetasIndex/fetchRecetaDetalle) -- el
// servidor filtra/rankea contra el catálogo completo y el cliente solo
// recibe las pocas recetas que de verdad va a mostrar. El contenido del
// menú diario/Misión/SOS sigue siendo libre para cualquier cuenta, gratis
// o Premium, exactamente como antes -- solo el Recetario (saltar a
// cualquier receta a demanda) y "¿Qué tienes en casa?" ahora sí requieren
// Premium de verdad para lo que no es gratis (antes era un blur de CSS
// sobre datos que ya estaban en memoria).
import { MEALS } from './data/meals.js';
import { REGIONALISMOS } from './data/regionalismos.js';
import { getState, setState, today } from './store.js';
import { resolverMenu, resolverPorEtiquetas, buscarPorIngrediente as buscarPorIngredienteAPI } from './supabase-client.js';
import { cachearMenuDelDia, leerMenuDelDiaCache, leerRecetaDetalleCache, cachearRecetasSueltas } from './recipesSync.js';

// "Idioma de alimentos" (Ajustes) -- cambia solo palabras puntuales que sí
// varían de país en país, nunca traduce nada más. Reemplazo por límites de
// palabra reales (incluye vocales acentuadas: \b de JS no las reconoce
// como parte de una palabra, así que un \bmaní\b no calzaría bien después
// de la "í"). Preserva mayúscula inicial si la palabra original la tenía.
// LIMITACIÓN CONOCIDA: es un reemplazo de texto, no un análisis gramatical
// -- no ajusta género/número de adjetivos cercanos. "½ aguacate pequeño"
// en Argentina queda "½ palta pequeño" (debería ser "pequeña", palta es
// femenino). Aceptable como primera versión -- resolverlo de verdad
// necesitaría procesar la gramática de cada frase, no solo la palabra.
function regionalizarTexto(texto, pais) {
  if (!texto || !pais || pais === 'co') return texto;
  let resultado = texto;
  for (const [canon, variantes] of Object.entries(REGIONALISMOS)) {
    const variante = variantes[pais];
    if (!variante) continue;
    const regex = new RegExp(`(^|[^a-zA-ZÀ-ÿ])(${canon})(?=[^a-zA-ZÀ-ÿ]|$)`, 'gi');
    resultado = resultado.replace(regex, (_m, pre, palabra) => {
      const conMayuscula = palabra[0] === palabra[0].toUpperCase() && palabra[0] !== palabra[0].toLowerCase();
      return pre + (conMayuscula ? variante.charAt(0).toUpperCase() + variante.slice(1) : variante);
    });
  }
  return resultado;
}

// Sigue siendo útil client-side: opera sobre UNA receta ya obtenida (del
// servidor), nunca sobre el catálogo completo.
function blockingGroups(recipe, exclusiones) {
  const groups = [];
  for (const ing of recipe.ingredientes) {
    if (ing.grupo && exclusiones.includes(ing.grupo)) {
      const subOk = ing.sub && !(ing.subGrupo && exclusiones.includes(ing.subGrupo));
      if (!subOk) groups.push(ing.grupo);
    }
  }
  return groups;
}

const normaliza = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function tieneExclusionLibre(recipe, exclusionesOtro) {
  if (!exclusionesOtro || !exclusionesOtro.length) return false;
  const terminos = exclusionesOtro.map(normaliza).filter(Boolean);
  if (!terminos.length) return false;
  return recipe.ingredientes.some((ing) => {
    const nombre = normaliza(ing.n);
    return terminos.some((t) => nombre.includes(t));
  });
}

// Sigue usándose sobre recetas YA obtenidas (ej. antes de mostrar el
// detalle, o dentro de displayRecipe/displayIngredient más abajo). Ya no
// filtra el catálogo completo -- eso ahora lo hace el servidor (ver
// recetas_index con p_exclusiones en supabase-client.js).
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
// Sigue usándose client-side sobre listas ya obtenidas del servidor (ej.
// el índice liviano del Recetario, o "mis recetas").
function score(recipe, perfiles) {
  const aptos = (recipe.apto || []).filter((p) => perfiles.includes(p)).length;
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
// mayúsculas) -- usada sobre el índice liviano del Recetario (solo nombre,
// nunca ingredientes completos, ver planner.js).
export function matchesSearch(recipe, query) {
  const q = normaliza(query).trim();
  if (!q) return true;
  return normaliza(recipe.nombre).includes(q);
}

// "¿Qué tienes en casa?" -- ahora corre en el servidor (ver
// buscarPorIngrediente en supabase-client.js), que aplica el mismo límite
// gratis/Premium que el Recetario. Acepta varios ingredientes separados
// por coma ("huevos, avena, banano"); el servidor ya ordena por
// coincidencias y afinidad al perfil.
export async function buscarPorIngredientes(texto) {
  const terminos = String(texto ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  if (!terminos.length) return [];
  // El servidor busca un término a la vez (ILIKE); se combinan los
  // resultados y se cuenta cuántos términos coincidieron por receta, igual
  // que antes.
  const porId = new Map();
  for (const termino of terminos) {
    const matches = await buscarPorIngredienteAPI(termino);
    for (const r of matches) {
      const entry = porId.get(r.id) || { recipe: r, coincidencias: 0 };
      entry.coincidencias += 1;
      porId.set(r.id, entry);
    }
  }
  return [...porId.values()]
    .sort((a, b) => b.coincidencias - a.coincidencias)
    .map((x) => x.recipe);
}

// Semilla determinística por fecha para variar el menú día a día -- ya no
// se usa acá directamente (vive del lado del servidor, ver
// supabase/functions/resolve-menu), se deja documentado por si algo local
// necesita reproducir la misma fecha->índice en el futuro.

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

// Menú del día: resuelto en el servidor (mismo algoritmo de antes: rota
// por fecha entre los 4 mejores candidatos de cada franja, respeta el
// desplazamiento manual de "cambiar receta", y asegura cobertura de
// proteína/vegetal). El cliente solo recibe las ≤5 recetas de hoy, nunca
// el catálogo completo.
export async function dailyMenu(dateStr = today()) {
  const { menuOverrides, user } = getState();
  const activas = mealsActivas(user);
  try {
    const [dia] = await resolverMenu({
      fechas: [dateStr],
      perfiles: user.perfiles || [],
      exclusiones: user.exclusiones || [],
      exclusionesOtro: user.exclusionesOtro || [],
      comidasActivas: user.comidasActivas || null,
      menuOverrides
    });
    const menu = activas.map((meal) => ({ meal, recipe: (dia?.menu || []).find((m) => m.mealId === meal.id)?.recipe || null }));
    // Se cachea SIEMPRE que se logra resolver online -- así este mismo día
    // queda disponible offline de ahí en adelante (contenido libre, ver
    // recipesSync.js).
    cachearMenuDelDia(dateStr, menu);
    return menu;
  } catch (e) {
    // Sin conexión (o el servidor falló): si ya se vio este día antes,
    // reconstruirlo desde la caché local en vez de dejar el menú vacío.
    const cache = await leerMenuDelDiaCache(dateStr);
    if (!cache) throw e;
    return Promise.all(activas.map(async (meal) => {
      const entry = cache.find((m) => m.mealId === meal.id);
      const recipe = entry?.recipeId ? await leerRecetaDetalleCache(entry.recipeId) : null;
      return { meal, recipe };
    }));
  }
}

// Menú de varios días de una sola vez (usado por weekMenu.js y
// rangeShoppingList) -- una sola llamada al servidor en vez de una por
// día.
export async function dailyMenuRange(fechas) {
  const { menuOverrides, user } = getState();
  const activas = mealsActivas(user);
  try {
    const dias = await resolverMenu({
      fechas,
      perfiles: user.perfiles || [],
      exclusiones: user.exclusiones || [],
      exclusionesOtro: user.exclusionesOtro || [],
      comidasActivas: user.comidasActivas || null,
      menuOverrides
    });
    return dias.map(({ fecha, menu: menuCrudo }) => {
      const porId = new Map(menuCrudo.map((m) => [m.mealId, m.recipe]));
      const menu = activas.map((meal) => ({ meal, recipe: porId.get(meal.id) || null }));
      cachearMenuDelDia(fecha, menu);
      return { fecha, menu };
    });
  } catch (e) {
    // Sin conexión: arma lo que se pueda desde días ya vistos antes; los
    // que nunca se cachearon quedan con recetas en null (weekMenu.js ya
    // se salta las comidas sin receta, igual que hoy con opciones vacías).
    const dias = await Promise.all(fechas.map(async (fecha) => {
      const cache = await leerMenuDelDiaCache(fecha);
      const menu = await Promise.all(activas.map(async (meal) => {
        const entry = cache?.find((m) => m.mealId === meal.id);
        const recipe = entry?.recipeId ? await leerRecetaDetalleCache(entry.recipeId) : null;
        return { meal, recipe };
      }));
      return { fecha, menu };
    }));
    if (dias.every((d) => d.menu.every((m) => !m.recipe))) throw e;
    return dias;
  }
}

// Sugiere UNA receta real del catálogo para acompañar el tema de un día
// del Plan de 7 días o una semana de la Misión (ej. la semana "Proteína
// en el desayuno" sugiere una receta con la etiqueta alto_proteina) --
// respeta exclusiones y semáforo como el resto del menú, nunca inventa
// nada. `comida` es opcional (null = cualquier comida); `etiquetas` es
// un array de etiquetas del catálogo, la mejor coincidencia gana.
export async function sugerirRecetaPorEtiquetas(comida, etiquetas = []) {
  const { user } = getState();
  const [receta] = await resolverPorEtiquetas({
    comida, etiquetas,
    perfiles: user.perfiles || [], exclusiones: user.exclusiones || [], exclusionesOtro: user.exclusionesOtro || [],
    primero: true
  });
  // Se cachea por id (no por día/semana -- a diferencia de dailyMenu, no
  // hay una clave estable para reproducir esta sugerencia sin conexión;
  // lo que sí queda offline es poder volver a ABRIR esta receta puntual
  // una vez que ya se mostró).
  if (receta) cachearRecetasSueltas([receta]);
  return receta || null;
}

// Sin targetIndex: rota a la siguiente opción (comportamiento anterior,
// no requiere red -- solo guarda un contador local, el propio dailyMenu()
// lo vuelve a resolver con el servidor en el próximo render).
// Con targetIndex: reservado para un futuro selector de alternativas
// específicas (hoy sin usar en la UI, ver dashboard.js) -- no se portó al
// servidor porque no hay ningún flujo real que lo dispare todavía.
export function swapMeal(mealId, dateStr = today()) {
  const key = `${dateStr}|${mealId}`;
  const { menuOverrides } = getState();
  setState({ menuOverrides: { ...menuOverrides, [key]: (menuOverrides[key] || 0) + 1 } });
}

// Nombre y emoji a mostrar para una receta: si el ingrediente que nombra el
// título está excluido (p. ej. "Tilapia al horno" cuando no se come pescado),
// se muestra el título alternativo en vez del original, no solo por dentro.
export function displayRecipe(recipe, exclusiones) {
  const pais = getState().user.paisAlimentos;
  const tituloSub = recipe.tituloSub || recipe.titulo_sub;
  if (tituloSub) {
    for (const grupo of Object.keys(tituloSub)) {
      if (exclusiones.includes(grupo)) {
        const alterno = tituloSub[grupo];
        return { ...alterno, nombre: regionalizarTexto(alterno.nombre, pais) };
      }
    }
  }
  return { nombre: regionalizarTexto(recipe.nombre, pais), emoji: recipe.emoji };
}

// Ingrediente a mostrar (aplica sustitución si el grupo está excluido, y
// "idioma de alimentos" -- ver regionalizarTexto arriba).
export function displayIngredient(ing, exclusiones) {
  const pais = getState().user.paisAlimentos;
  if (ing.grupo && exclusiones.includes(ing.grupo) && ing.sub) {
    return { texto: regionalizarTexto(ing.sub, pais), sustituido: true, original: ing.n, cantidad: null, resto: null };
  }
  // cantidad/resto vienen de la receta (número + el texto sin ese número,
  // ej. "1 taza de espinaca" -> cantidad:1, resto:"taza de espinaca") --
  // permiten sumar cantidades reales en la lista de compras proyectada en
  // vez de solo contar apariciones. No todos los ingredientes lo tienen
  // (ej. "Canela al gusto" no tiene una cantidad real que sumar). resto
  // también se regionaliza -- textoConCantidad() lo muestra directo.
  return {
    texto: regionalizarTexto(ing.n, pais),
    sustituido: false,
    cantidad: ing.cantidad ?? null,
    resto: ing.resto ? regionalizarTexto(ing.resto, pais) : (ing.resto ?? null)
  };
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
// nombre real del ingrediente; "Otros" es el fallback honesto para lo que
// no reconoce, no se fuerza una categoría incorrecta.
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
export async function shoppingList(dateStr = today()) {
  const { user } = getState();
  const items = [];
  for (const { recipe } of await dailyMenu(dateStr)) {
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

// Lista de compras proyectada a varios días: el menú es determinístico por
// fecha (misma semilla + overrides guardados) y ahora se resuelve en el
// servidor en UNA sola llamada para todo el rango (dailyMenuRange), en vez
// de una petición por día. Cuando el ingrediente trae cantidad/resto reales,
// se suman de verdad (ej. "2 huevos" + "1 huevo" -> "3 huevos"); si no los
// trae (ej. "Canela al gusto"), no se inventa un número — se sigue
// mostrando en cuántos días/recetas aparece, como antes. Se agrupa por
// `resto` cuando existe para que variantes con distinta cantidad del mismo
// ingrediente se fusionen en un solo renglón en vez de listarse aparte.
export async function rangeShoppingList(days, startDate = today()) {
  const { user } = getState();
  const fechas = Array.from({ length: days }, (_, i) => addDays(startDate, i));
  const dias = await dailyMenuRange(fechas);
  const map = new Map();
  for (const { fecha, menu } of dias) {
    const weekday = DIAS_CORTOS[new Date(fecha + 'T00:00:00').getDay()];
    for (const { recipe } of menu) {
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

// Snacks anti-ansiedad disponibles para el usuario -- mismo criterio que
// candidatesFor (ahora del lado del servidor): si hay perfiles de salud
// activos, prioriza solo los snacks que de verdad ayudan a esa condición.
export async function sosSnacks() {
  const { user } = getState();
  const snacks = await resolverPorEtiquetas({
    comida: null, etiquetas: ['snack_antiansiedad'], etiquetaObligatoria: true,
    perfiles: user.perfiles || [], exclusiones: user.exclusiones || [], exclusionesOtro: user.exclusionesOtro || []
  });
  cachearRecetasSueltas(snacks);
  return snacks;
}
