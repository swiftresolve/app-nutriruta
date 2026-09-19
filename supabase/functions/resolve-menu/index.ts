// Resuelve el menú del día (o de un rango) contra el catálogo COMPLETO de
// recetas en Postgres, sin que el cliente reciba nunca más que las recetas
// que de verdad va a mostrar -- puerto exacto de la lógica que antes vivía
// enteramente en js/menu.js (candidatesFor/daySeed/asegurarCobertura), que
// dependía de tener las 105 recetas cargadas en el navegador para poder
// filtrar/rankear. El contenido que devuelve sigue siendo libre para
// cualquier cuenta (gratis o Premium) -- ver [[proyecto-nutriruta]], esto
// NO aplica el límite de recetas gratis/Premium (eso vive en receta_detalle
// / buscar_por_ingrediente, para el Recetario y la búsqueda por
// ingrediente). Aquí el objetivo es solo que el navegador nunca tenga el
// catálogo entero en memoria.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('APP_URL') ?? 'https://nutriruta.app';
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Duplicado a propósito de js/data/meals.js (el deploy de esta función no
// comparte módulos con el cliente) -- mismo patrón ya usado con
// PERFIL_CLAVES en generate-recipe/index.ts.
const MEALS = [
  { id: 'desayuno' },
  { id: 'media_manana' },
  { id: 'almuerzo' },
  { id: 'media_tarde' },
  { id: 'cena' }
];
const MEALS_PRINCIPALES = ['desayuno', 'almuerzo', 'cena'];

// ---- Puerto de js/data/categoriasAlimentos.js ----
const CATEGORIAS_ALIMENTOS: Record<string, string[]> = {
  proteina: [
    'huevo', 'huevos', 'clara de huevo', 'claras de huevo', 'pollo', 'pechuga', 'pescado', 'atún', 'atun',
    'salmón', 'salmon', 'tilapia', 'camarones', 'carne', 'res', 'cerdo', 'pavo', 'lenteja', 'lentejas',
    'garbanzo', 'garbanzos', 'frijol', 'frijoles', 'queso', 'queso fresco', 'queso costeño', 'queso costeno',
    'requesón', 'requeson', 'yogur griego', 'yogurt griego', 'tofu', 'proteína', 'proteina', 'kumis'
  ],
  vegetal: [
    'lechuga', 'espinaca', 'espinacas', 'tomate', 'pepino', 'zanahoria', 'brócoli', 'brocoli', 'calabacín',
    'calabacin', 'pimentón', 'pimenton', 'cebolla', 'repollo', 'coliflor', 'apio', 'rúgula', 'arugula',
    'acelga', 'champiñones', 'champinones', 'verduras', 'ensalada', 'habichuela', 'habichuelas', 'ahuyama'
  ],
  carbohidrato: [
    'arroz', 'papa', 'papas', 'yuca', 'plátano', 'platano', 'avena', 'pan integral', 'pan', 'quinoa',
    'pasta integral', 'arepa', 'tortilla', 'maíz', 'maiz', 'camote', 'batata'
  ]
};

type Ingrediente = { n: string; cantidad?: number; resto?: string; grupo?: string; sub?: string; subGrupo?: string };
type Receta = {
  id: string; comida: string; tiempo_min: number | null; emoji: string | null; nombre: string;
  descripcion: string | null; titulo_sub: unknown; ingredientes: Ingrediente[]; pasos: string[];
  apto: string[]; moderar: string[]; evitar: string[]; etiquetas: string[];
};

function quitarAcentos(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function categoriasDeIngredientes(ingredientes: Ingrediente[]): Set<string> {
  const texto = quitarAcentos((ingredientes || []).map((i) => i.n || '').join(' '));
  const presentes = new Set<string>();
  for (const [categoria, palabras] of Object.entries(CATEGORIAS_ALIMENTOS)) {
    if (palabras.some((p) => texto.includes(quitarAcentos(p)))) presentes.add(categoria);
  }
  return presentes;
}

// ---- Puerto de js/menu.js ----
function blockingGroups(recipe: Receta, exclusiones: string[]): string[] {
  const groups: string[] = [];
  for (const ing of recipe.ingredientes) {
    if (ing.grupo && exclusiones.includes(ing.grupo)) {
      const subOk = ing.sub && !(ing.subGrupo && exclusiones.includes(ing.subGrupo));
      if (!subOk) groups.push(ing.grupo);
    }
  }
  return groups;
}

function tieneExclusionLibre(recipe: Receta, exclusionesOtro: string[]): boolean {
  if (!exclusionesOtro || !exclusionesOtro.length) return false;
  const terminos = exclusionesOtro.map(quitarAcentos).filter(Boolean);
  if (!terminos.length) return false;
  return recipe.ingredientes.some((ing) => {
    const nombre = quitarAcentos(ing.n || '');
    return terminos.some((t) => nombre.includes(t));
  });
}

function isRecipeAvailable(recipe: Receta, exclusiones: string[], exclusionesOtro: string[]): boolean {
  return blockingGroups(recipe, exclusiones).length === 0 && !tieneExclusionLibre(recipe, exclusionesOtro);
}

function trafficLight(recipe: Receta, perfiles: string[]): 'rojo' | 'amarillo' | 'verde' {
  if (recipe.evitar && recipe.evitar.some((p) => perfiles.includes(p))) return 'rojo';
  if (recipe.moderar && recipe.moderar.some((p) => perfiles.includes(p))) return 'amarillo';
  return 'verde';
}

function score(recipe: Receta, perfiles: string[]): number {
  const aptos = (recipe.apto || []).filter((p) => perfiles.includes(p)).length;
  const light = trafficLight(recipe, perfiles);
  return aptos + (light === 'verde' ? 2 : light === 'amarillo' ? 0 : -10);
}

function candidatesFor(recetas: Receta[], mealId: string, perfiles: string[], exclusiones: string[], exclusionesOtro: string[]): Receta[] {
  const disponibles = recetas
    .filter((r) => r.comida === mealId && isRecipeAvailable(r, exclusiones, exclusionesOtro))
    .filter((r) => trafficLight(r, perfiles) !== 'rojo');

  if (perfiles.length) {
    const queAyudan = disponibles.filter((r) => (r.apto || []).some((p) => perfiles.includes(p)));
    if (queAyudan.length >= 4) return queAyudan.sort((a, b) => score(b, perfiles) - score(a, perfiles));
  }
  return disponibles.sort((a, b) => score(b, perfiles) - score(a, perfiles));
}

function daySeed(dateStr: string): number {
  let h = 0;
  for (const c of dateStr) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function mealsActivas(comidasActivas: Record<string, boolean> | null | undefined) {
  return MEALS.filter((m) => !comidasActivas || comidasActivas[m.id] !== false);
}

type MenuItem = { meal: { id: string }; recipe: Receta | null; options: Receta[]; manual?: boolean };

function asegurarCobertura(menu: MenuItem[]) {
  const principales = menu.filter((m) => MEALS_PRINCIPALES.includes(m.meal.id) && m.recipe);
  if (!principales.length) return;

  const categoriasDelDia = () => {
    const set = new Set<string>();
    for (const m of principales) for (const c of categoriasDeIngredientes(m.recipe!.ingredientes)) set.add(c);
    return set;
  };

  function intentarCubrir(categoria: string, comidasEnOrden: string[]) {
    if (categoriasDelDia().has(categoria)) return;
    for (const idComida of comidasEnOrden) {
      const item = principales.find((m) => m.meal.id === idComida);
      if (!item?.options || item.manual) continue;
      const reemplazo = item.options.find((r) => r.id !== item.recipe!.id && categoriasDeIngredientes(r.ingredientes).has(categoria));
      if (reemplazo) { item.recipe = reemplazo; return; }
    }
  }

  intentarCubrir('proteina', ['almuerzo', 'cena', 'desayuno']);
  intentarCubrir('vegetal', ['almuerzo', 'cena']);
}

function resolverMenuDelDia(
  recetas: Receta[],
  dateStr: string,
  perfiles: string[],
  exclusiones: string[],
  exclusionesOtro: string[],
  comidasActivas: Record<string, boolean> | null,
  menuOverrides: Record<string, number>
): { mealId: string; recipe: Receta | null }[] {
  const seed = daySeed(dateStr);
  const menu: MenuItem[] = [];
  for (const meal of mealsActivas(comidasActivas)) {
    const options = candidatesFor(recetas, meal.id, perfiles, exclusiones, exclusionesOtro);
    if (!options.length) { menu.push({ meal, recipe: null, options }); continue; }
    const pool = options.slice(0, Math.min(4, options.length));
    const shift = menuOverrides[`${dateStr}|${meal.id}`] || 0;
    const idx = (seed + MEALS.findIndex((m) => m.id === meal.id) + shift) % pool.length;
    menu.push({ meal, recipe: pool[idx], options, manual: shift !== 0 });
  }
  asegurarCobertura(menu);
  return menu.map(({ meal, recipe }) => ({ mealId: meal.id, recipe }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user) return json({ error: 'No autorizado' }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const perfiles = Array.isArray(payload.perfiles) ? (payload.perfiles as string[]) : [];
  const exclusiones = Array.isArray(payload.exclusiones) ? (payload.exclusiones as string[]) : [];
  const exclusionesOtro = Array.isArray(payload.exclusionesOtro) ? (payload.exclusionesOtro as string[]) : [];

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: recetas, error } = await admin.from('recetas').select('*');
  if (error || !recetas) {
    console.error('Error leyendo recetas:', error);
    return json({ error: 'No se pudo cargar el catálogo.' }, 500);
  }

  const modo = String(payload.modo ?? 'menu');

  // Modo "etiquetas": sugerirRecetaPorEtiquetas()/sosSnacks() de menu.js --
  // Plan de 7 días/Misión/SOS, mismo criterio (perfil+exclusiones+semáforo,
  // nunca rojo), libre para cualquier cuenta igual que el menú diario. Con
  // `primero` devuelve solo la mejor (sugerirRecetaPorEtiquetas); sin eso,
  // la lista completa ya rankeada (sosSnacks). `etiquetaObligatoria`
  // distingue los dos criterios de fallback: sugerirRecetaPorEtiquetas cae
  // a CUALQUIER receta disponible si ninguna trae la etiqueta (más vale
  // sugerir algo que nada); sosSnacks NUNCA debe mostrar algo que no sea
  // realmente un snack, así que si ninguna receta trae la etiqueta el
  // resultado es una lista vacía, no el catálogo completo.
  if (modo === 'etiquetas') {
    const comida = payload.comida ? String(payload.comida) : null;
    const etiquetas = Array.isArray(payload.etiquetas) ? (payload.etiquetas as string[]) : [];
    const primero = !!payload.primero;
    const etiquetaObligatoria = !!payload.etiquetaObligatoria;
    const pool = (recetas as Receta[])
      .filter((r) => (!comida || r.comida === comida) && isRecipeAvailable(r, exclusiones, exclusionesOtro))
      .filter((r) => trafficLight(r, perfiles) !== 'rojo');
    if (!pool.length) return json({ recetas: [] });
    const conEtiqueta = etiquetas.length ? pool.filter((r) => (r.etiquetas || []).some((e) => etiquetas.includes(e))) : [];
    const candidatos = conEtiqueta.length ? conEtiqueta : (etiquetaObligatoria ? [] : pool);
    const ordenadas = candidatos.sort((a, b) => score(b, perfiles) - score(a, perfiles));
    return json({ recetas: primero ? ordenadas.slice(0, 1) : ordenadas });
  }

  const fechas = Array.isArray(payload.fechas) ? (payload.fechas as string[]).slice(0, 40) : [];
  if (!fechas.length) return json({ error: 'Falta fechas.' }, 400);
  const comidasActivas = (payload.comidasActivas as Record<string, boolean>) || null;
  const menuOverrides = (payload.menuOverrides as Record<string, number>) || {};

  const dias = fechas.map((fecha) => ({
    fecha,
    menu: resolverMenuDelDia(recetas as Receta[], fecha, perfiles, exclusiones, exclusionesOtro, comidasActivas, menuOverrides)
  }));

  return json({ dias });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
