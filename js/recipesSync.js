// Caché local (IndexedDB) del catálogo de recetas -- reemplaza el
// precacheo ciego que hacía sw.js con js/data/recipes.js (todo el
// catálogo, para cualquiera, con o sin sesión). Ahora cada cuenta
// sincroniza localmente SOLO lo que tiene derecho a ver:
//   - el índice liviano (siempre, cualquier cuenta) -- para pintar la
//     grilla del Recetario offline (títulos/semáforo/candado), nunca el
//     contenido.
//   - el detalle completo de las recetas gratis (siempre, cualquier
//     cuenta) -- el set gratuito real, no una posición fija.
//   - el detalle completo de TODO el catálogo, si hay Premium vigente --
//     así una cuenta que paga tiene el Recetario 100% offline igual que
//     antes, transparente, sin que se note el cambio.
//   - cualquier receta que ya se vio por el menú diario/Misión/SOS (que
//     siempre es contenido libre) se cachea al vuelo apenas llega del
//     servidor, sin esperar a la sincronización general.
//
// Una cuenta gratis que nunca tuvo Premium simplemente nunca sincronizó
// el resto del catálogo -- no es una regresión de una función quitada,
// es exactamente el hueco de seguridad cerrado: antes ESE contenido ya
// estaba en su navegador igual, pagando o no.
import { isPremium } from './store.js';
import { fetchRecetasIndex, fetchRecetaDetalle } from './supabase-client.js';

const DB_NAME = 'nutriruta-recetas';
const DB_VERSION = 1;
const STORE_DETALLE = 'detalle';
const STORE_INDICE = 'indice';
const STORE_MENU_DIA = 'menu_dia';
const KEY_INDICE_ACTUAL = 'actual';

let dbPromise = null;
function abrirDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB no disponible')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DETALLE)) db.createObjectStore(STORE_DETALLE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_INDICE)) db.createObjectStore(STORE_INDICE);
      // Clave = fecha 'YYYY-MM-DD' -- guarda solo {mealId, recipeId}[], el
      // contenido real de cada receta vive en STORE_DETALLE (ver
      // cachearMenuDelDia). Así "el menú de hoy ya visto" queda disponible
      // offline sin duplicar el contenido completo por cada día.
      if (!db.objectStoreNames.contains(STORE_MENU_DIA)) db.createObjectStore(STORE_MENU_DIA);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// Todo lo de acá abajo traga errores en vez de propagarlos -- IndexedDB
// puede fallar por muchas razones ajenas a nosotros (modo privado, cuota
// llena, navegador raro); el catálogo simplemente no queda offline en
// ese caso, nunca debe romper la app en uso normal con conexión.
async function idbGet(store, key) {
  try {
    const db = await abrirDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function idbPut(store, value, key) {
  try {
    const db = await abrirDB();
    await new Promise((resolve) => {
      const tx = db.transaction(store, 'readwrite');
      key !== undefined ? tx.objectStore(store).put(value, key) : tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* sin caché local, sigue funcionando online */ }
}

export async function leerRecetaDetalleCache(id) {
  return idbGet(STORE_DETALLE, id);
}

export async function guardarRecetaDetalleCache(receta) {
  if (!receta?.id || !receta.ingredientes) return; // nunca cachear un resultado bloqueado/incompleto
  await idbPut(STORE_DETALLE, receta);
}

export async function leerRecetasIndiceCache() {
  return idbGet(STORE_INDICE, KEY_INDICE_ACTUAL);
}

async function guardarRecetasIndiceCache(indice) {
  await idbPut(STORE_INDICE, indice, KEY_INDICE_ACTUAL);
}

// El menú diario/Misión/SOS es contenido libre para cualquier cuenta (ver
// [[proyecto-nutriruta]]) -- cachear lo ya visto no es aplicar el límite
// gratis/Premium, es simplemente dejarlo disponible offline como antes.
// `menu` es el arreglo {mealId, recipe}[] que devuelve dailyMenu().
export async function cachearMenuDelDia(dateStr, menu) {
  await Promise.all(menu.filter((m) => m.recipe).map((m) => guardarRecetaDetalleCache(m.recipe)));
  await idbPut(STORE_MENU_DIA, menu.map((m) => ({ mealId: m.meal.id, recipeId: m.recipe?.id || null })), dateStr);
}

export async function leerMenuDelDiaCache(dateStr) {
  return idbGet(STORE_MENU_DIA, dateStr);
}

// sugerirRecetaPorEtiquetas()/sosSnacks() también son contenido libre --
// cachear cualquier receta que devuelvan para que, si se abre offline más
// tarde (ej. desde el Plan de 7 días), ya esté disponible.
export async function cachearRecetasSueltas(recetas) {
  await Promise.all((recetas || []).filter(Boolean).map(guardarRecetaDetalleCache));
}

// Sincronización general -- se llama una vez al abrir la app con sesión y
// conexión (ver app.js). No bloquea nada: corre en segundo plano y cada
// receta que logra traer queda disponible offline de ahí en adelante.
export async function sincronizarCatalogo(user) {
  if (!navigator.onLine) return;
  let indice;
  try {
    indice = await fetchRecetasIndex(user.exclusiones || [], user.exclusionesOtro || []);
  } catch { return; } // sin conexión real o sesión vencida -- se reintenta en el próximo boot
  await guardarRecetasIndiceCache(indice);

  const premium = isPremium();
  const objetivo = premium ? indice : indice.filter((r) => r.gratis);

  // Batched y despacio (no Promise.all de una): son hasta 100 llamadas si
  // hay Premium, no hace falta ni conviene dispararlas todas a la vez.
  const LOTE = 5;
  for (let i = 0; i < objetivo.length; i += LOTE) {
    const lote = objetivo.slice(i, i + LOTE);
    await Promise.all(lote.map(async (r) => {
      const yaEsta = await leerRecetaDetalleCache(r.id);
      if (yaEsta) return;
      try {
        const completa = await fetchRecetaDetalle(r.id);
        await guardarRecetaDetalleCache(completa);
      } catch { /* esta receta puntual no quedó offline, no es fatal */ }
    }));
  }
}
