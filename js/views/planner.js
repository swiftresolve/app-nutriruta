// Recetario + lista de compras.
import { getState, setState, isPremium, toggleFavorita, agregarRecetaPropia, eliminarRecetaPropia, gastarNutricoins, COSTO_RECETA_IA, esc } from '../store.js';
import { RECIPES, MEALS } from '../data/recipes.js';
import { isRecipeAvailable, trafficLight, trafficLightRecetaPropia, shoppingList, rangeShoppingList, displayRecipe, rankRecipes, matchesSearch, agruparPorCategoria, textoConCantidad } from '../menu.js';
import { header, navigate, toast, openModal, SEARCH_ICON, CAMERA_ICON, abrirComprarNutricoins, coinIcon, ORO_NUTRICOINS, PLATA_NUTRICOINS } from '../app.js';
import { generarRecetaIA, generarRecetaDesdeFoto, generarRecetaDesdeEnlace } from '../supabase-client.js';
import { openRecipe } from './dashboard.js';

const ORDENES = [
  { id: 'recomendadas', label: '🌿 Recomendadas' },
  { id: 'nombre', label: '🔤 Nombre (A-Z)' },
  { id: 'rapido', label: '⚡ Más rápidas' },
  { id: 'mias', label: '📝 Mis recetas' }
];

// Recetas visibles en el plan gratuito (el resto se muestra bloqueado).
const FREE_RECIPE_LIMIT = 12;

// Traducción de las etiquetas reales de cada receta (data/recipes.js) a un
// chip corto y amigable — no inventa datos, solo los presenta mejor.
export const TAG_LABELS = {
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
export const HOT_MEALS = new Set(['desayuno', 'almuerzo', 'cena']);

// Comprime/redimensiona la foto en el cliente antes de mandarla a la IA --
// mismo criterio que toJpegBase64 en mealLogModal.js, no vale la pena
// compartir un módulo de una sola función tan chica.
function comprimirFotoReceta(file, maxDim = 1000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      URL.revokeObjectURL(img.src);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error('Imagen inválida.'));
    img.src = URL.createObjectURL(file);
  });
}

// Etiqueta corta según cómo se creó la receta propia -- un solo lugar para
// las 4 variantes (antes solo distinguía ia/manual).
// Selector de comida (chip + menú desplegable) reutilizado por los 4 flujos
// de crear receta con IA (texto/foto/enlace) -- antes solo existía dentro
// de abrirDescribirRecetaIA, se extrajo para no triplicarlo.
function montarSelectorComida(modal, btnEl, menuEl, comidaInicial) {
  let comidaElegida = comidaInicial;
  function pintarBtnComida() {
    const m = MEALS.find((x) => x.id === comidaElegida);
    btnEl.textContent = `${m.emoji} ${m.nombre} ⌄`;
  }
  pintarBtnComida();
  for (const m of MEALS) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'habit selector-opcion' + (m.id === comidaElegida ? ' selected' : '');
    row.innerHTML = `<label>${m.emoji} ${m.nombre}</label>${m.id === comidaElegida ? '<span>✓</span>' : ''}`;
    row.addEventListener('click', () => {
      comidaElegida = m.id;
      pintarBtnComida();
      menuEl.classList.add('hidden');
      menuEl.querySelectorAll('.selector-opcion').forEach((r) => {
        r.classList.toggle('selected', r === row);
        const check = r.querySelector('span');
        if (r === row && !check) r.insertAdjacentHTML('beforeend', '<span>✓</span>');
        if (r !== row && check) check.remove();
      });
    });
    menuEl.appendChild(row);
  }
  btnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    menuEl.classList.toggle('hidden');
  });
  modal.addEventListener('click', (e) => {
    if (e.target !== btnEl && !menuEl.contains(e.target)) menuEl.classList.add('hidden');
  });
  return { getComida: () => comidaElegida };
}

function origenLabel(receta) {
  if (receta.origen === 'ia') return '✨ Generada con IA';
  if (receta.origen === 'foto') return receta.reconstruida ? '📷 Reconstruida de una foto' : '📷 Desde una foto';
  if (receta.origen === 'enlace') return '🔗 Desde un enlace';
  return '✏️ Tuya';
}

// "Crear manualmente" -- formulario simple: nombre, comida, ingredientes y
// pasos en texto libre. A propósito SIN calorías ni macros, igual que el
// resto del recetario -- este es contenido de la usuaria, no algo que
// NutriRuta valide, así que tampoco se le pone semáforo ni "apto para".
function abrirFormularioReceta(onGuardada) {
  openModal((modal, closeFn) => {
    let comidaElegida = MEALS[0].id;
    modal.insertAdjacentHTML('beforeend', `
      <h2>✏️ Crear receta</h2>
      <p class="small muted mt">Sin calorías ni macros -- solo lo que de verdad necesitas para prepararla.</p>
      <label class="muted small mt" style="display:block;font-weight:600">Nombre</label>
      <input id="rp-nombre" type="text" maxlength="80" placeholder="Ej: Tostadas con aguacate y huevo" class="auth-input">
      <label class="muted small mt" style="display:block;font-weight:600">¿Para cuál comida?</label>
      <div class="chips mt" id="rp-comida"></div>
      <label class="muted small mt" style="display:block;font-weight:600">Descripción breve (opcional)</label>
      <input id="rp-desc" type="text" maxlength="200" placeholder="Ej: Rápida, ideal para las mañanas ocupadas" class="auth-input">
      <div class="row mt" style="gap:12px">
        <div style="flex:1">
          <label class="muted small" style="display:block;font-weight:600">Porciones</label>
          <input id="rp-porciones" type="number" min="1" max="20" value="1" class="auth-input">
        </div>
        <div style="flex:1">
          <label class="muted small" style="display:block;font-weight:600">Tiempo (min)</label>
          <input id="rp-tiempo" type="number" min="0" max="240" value="15" class="auth-input">
        </div>
      </div>
      <label class="muted small mt" style="display:block;font-weight:600">Ingredientes</label>
      <p class="small muted" style="margin-top:2px">Uno por línea.</p>
      <textarea id="rp-ingredientes" class="auth-input" rows="4" placeholder="2 huevos
1 aguacate
2 tostadas integrales"></textarea>
      <label class="muted small mt" style="display:block;font-weight:600">Pasos</label>
      <p class="small muted" style="margin-top:2px">Uno por línea.</p>
      <textarea id="rp-pasos" class="auth-input" rows="4" placeholder="Tostar el pan
Machacar el aguacate
Freír los huevos"></textarea>
      <button type="button" class="btn full mt" id="rp-guardar">Guardar receta</button>`);

    const chipsEl = modal.querySelector('#rp-comida');
    for (const m of MEALS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip small' + (m.id === comidaElegida ? ' selected' : '');
      b.textContent = `${m.emoji} ${m.nombre}`;
      b.addEventListener('click', () => {
        comidaElegida = m.id;
        chipsEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c === b));
      });
      chipsEl.appendChild(b);
    }

    modal.querySelector('#rp-guardar').addEventListener('click', () => {
      const nombre = modal.querySelector('#rp-nombre').value.trim();
      if (!nombre) { toast('Escribe un nombre para tu receta.'); return; }
      const ingredientes = modal.querySelector('#rp-ingredientes').value.split('\n');
      const pasos = modal.querySelector('#rp-pasos').value.split('\n');
      agregarRecetaPropia({
        nombre,
        comida: comidaElegida,
        descripcion: modal.querySelector('#rp-desc').value.trim(),
        porciones: modal.querySelector('#rp-porciones').value,
        tiempoMin: modal.querySelector('#rp-tiempo').value,
        ingredientes,
        pasos
      });
      closeFn();
      toast('¡Receta guardada! 🌿');
      if (onGuardada) onGuardada();
    });
  });
}

// Detalle de una receta propia -- misma estructura que openRecipe()
// (dashboard.js: tamaño de emoji, clase .ingredient por ingrediente,
// <ol class="steps"> para los pasos) más lo que sí es propio de estas
// recetas (de dónde salió, porciones/tiempo, el aviso de "reconstruida",
// y el botón de eliminar) -- lo que openRecipe() no tiene porque el
// catálogo curado no lo necesita (no hay "apto para"/sustituciones aquí,
// texto libre en vez de ingredientes estructurados).
function abrirRecetaPropia(receta, onEliminada) {
  const meal = MEALS.find((m) => m.id === receta.comida);
  openModal((modal, closeFn) => {
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2.4rem">${esc(receta.emoji)}</div>
      <h2>${esc(receta.nombre)}</h2>
      <p class="small muted">${meal ? `${meal.emoji} ${esc(meal.nombre)}` : ''} · ${origenLabel(receta)}${receta.tiempoMin ? ` · 🍽️ ${receta.porciones || 1} porción${(receta.porciones || 1) === 1 ? '' : 'es'} · ⏱️ ${receta.tiempoMin} min` : ''}</p>
      ${receta.reconstruida ? `<p class="small mt" style="background:var(--accent-soft);border-radius:var(--radius);padding:10px 12px">⚠️ La IA reconstruyó esta receta a partir de la foto del plato, no de una receta escrita -- revisa cantidades y pasos antes de prepararla.</p>` : ''}
      ${receta.descripcion ? `<p class="small mt">${esc(receta.descripcion)}</p>` : ''}
      ${receta.ingredientes.length ? `
        <h3 class="mt">Ingredientes</h3>
        ${receta.ingredientes.map((i) => `<div class="ingredient">• ${esc(i)}</div>`).join('')}` : ''}
      ${receta.pasos.length ? `
        <h3 class="mt">Preparación</h3>
        <ol class="steps">${receta.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}
      <button type="button" class="btn danger full mt" id="rp-eliminar">🗑️ Eliminar receta</button>`);
    modal.querySelector('#rp-eliminar').addEventListener('click', () => {
      confirmarEliminarReceta(receta.nombre, () => {
        eliminarRecetaPropia(receta.id);
        closeFn();
        toast('Receta eliminada.');
        if (onEliminada) onEliminada();
      });
    });
  });
}

// Confirmación antes de borrar -- es irreversible (no hay papelera ni
// deshacer, ver eliminarRecetaPropia en store.js), mismo criterio que
// "Borrar todos mis datos" en Ajustes: nunca un solo toque.
function confirmarEliminarReceta(nombre, onConfirmar) {
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <h2>¿Eliminar "${esc(nombre)}"?</h2>
      <p class="mt">Esta acción no se puede deshacer.</p>`);
    const yes = document.createElement('button');
    yes.className = 'btn danger full mt';
    yes.textContent = 'Sí, eliminar';
    yes.addEventListener('click', () => { close(); onConfirmar(); });
    modal.appendChild(yes);
  });
}

export function renderPlanner(container, params = {}) {
  header(container);
  let tab = params.tab || 'recetas';
  let mealFilter = 'todas';
  let orden = 'recomendadas';
  let soloFavoritas = false;
  let rango = 'hoy';
  let busqueda = '';
  // El buscador vive detrás de una lupa (no siempre visible) -- el
  // espacio que ocupaba antes ahora es de "Crear con IA"/"Crear
  // manualmente" por defecto, y se convierte en el buscador solo
  // mientras está activo.
  let mostrarBusqueda = false;

  // "Crear con IA" -- nada de pantalla previa a llenar: tocar el botón
  // genera de inmediato (mismo criterio que Fitia) usando la comida ya
  // seleccionada en los filtros (o Desayuno si está en "Todas"). El banner
  // de progreso vive en el propio grid, no en un modal. `nuevasIds` marca
  // qué recetas de "Tus recetas" son de esta sesión de generación, para el
  // tag "Nuevo" y para que "Ver" las encuentre ya arriba de la sección
  // (renderMisRecetas ordena las nuevas primero).
  let iaEstado = 'idle'; // 'idle' | 'generando' | 'lista'
  let iaTimer = null;
  let iaCantidad = 1;
  let iaCompletadas = 0;
  const nuevasIds = new Set();

  // La barra de búsqueda vive SOBREPUESTA encima de las pestañas
  // Recetario/Lista de compras (position:absolute dentro de tabsRow), no
  // dentro del body -- así al abrirla/cerrarla nada de lo que hay debajo
  // (botones de crear, filtros, grid) se mueve.
  const tabsRow = document.createElement('div');
  tabsRow.className = 'row mb';
  tabsRow.style.cssText = 'position:relative';
  const tabs = document.createElement('div');
  // "chips" normalmente envuelve línea (para las de perfiles/filtros, eso
  // se quiere) -- pero acá "Recetario"/"Lista de compras" deben quedarse
  // SIEMPRE en una sola fila junto a la lupa, sin importar el tamaño de
  // fuente del teléfono. "recetario-tabs" fuerza eso y las deja del
  // MISMO ancho entre sí (grilla de 2 columnas, no flex por contenido) --
  // para que la grilla reparta ancho real entre las columnas, "tabs"
  // necesita flex:1 aquí (si no, el contenedor se encoge a su contenido
  // y 1fr/1fr deja de significar "mitad y mitad"). Sin justify-content:
  // space-between en tabsRow, la lupa queda pegada justo después,
  // separada solo por el gap normal de .row, no empujada al borde.
  tabs.className = 'chips recetario-tabs';
  tabs.style.cssText = 'flex:1;min-width:0';
  tabsRow.appendChild(tabs);
  const searchToggleBtn = document.createElement('button');
  searchToggleBtn.type = 'button';
  searchToggleBtn.className = 'icon-btn plain';
  searchToggleBtn.setAttribute('aria-label', 'Buscar recetas');
  searchToggleBtn.innerHTML = SEARCH_ICON;
  const searchOverlay = document.createElement('div');
  searchOverlay.className = 'row hidden';
  searchOverlay.style.cssText = 'position:absolute;inset:0;align-items:center;gap:8px;background:var(--bg);z-index:3';
  searchOverlay.innerHTML = `
    <input id="recetas-buscar" type="search" inputmode="search" placeholder="Buscar por nombre o ingrediente…"
      style="flex:1;min-width:0;padding:8px 12px;border-radius:10px;border:1px solid var(--border);font:inherit;font-size:0.9rem;box-sizing:border-box;background:var(--card);color:var(--ink)">
    <button type="button" class="icon-btn plain" id="cerrar-buscar" aria-label="Cerrar búsqueda"><span style="font-size:1.1rem">✕</span></button>`;
  tabsRow.appendChild(searchOverlay);
  const searchInputEl = searchOverlay.querySelector('#recetas-buscar');
  searchInputEl.addEventListener('input', (e) => { busqueda = e.target.value; drawBody(); });
  searchOverlay.querySelector('#cerrar-buscar').addEventListener('click', () => {
    mostrarBusqueda = false;
    busqueda = '';
    searchInputEl.value = '';
    searchOverlay.classList.add('hidden');
    drawBody();
  });
  searchToggleBtn.addEventListener('click', () => {
    mostrarBusqueda = !mostrarBusqueda;
    searchOverlay.classList.toggle('hidden', !mostrarBusqueda);
    if (mostrarBusqueda) searchInputEl.focus();
  });
  const body = document.createElement('div');

  function drawTabs() {
    tabs.innerHTML = '';
    const [recetasTab, comprasTab] = [['recetas', '🥗 Recetario'], ['compras', '🛒 Lista de compras']].map(([id, label]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (tab === id ? ' selected' : '');
      b.textContent = label;
      b.addEventListener('click', () => { tab = id; drawTabs(); drawBody(); });
      return b;
    });
    // La lupa va en la columna central de la grilla, entre las dos
    // pestañas -- no suelta al final de la fila.
    tabs.append(recetasTab, searchToggleBtn, comprasTab);
    // La búsqueda solo aplica al recetario, no a la lista de compras.
    searchToggleBtn.style.display = tab === 'recetas' ? '' : 'none';
    if (tab !== 'recetas') {
      mostrarBusqueda = false;
      searchOverlay.classList.add('hidden');
    }
  }

  function drawBody() {
    body.innerHTML = '';
    tab === 'recetas' ? drawRecipes() : drawShopping();
  }

  // Banner de "Crear con IA" -- vive dentro del grid, no en un modal. Dos
  // estados: 'generando' (icono + barra de progreso -- proporción REAL de
  // recetas completadas, con una animación suave dentro de cada una
  // mientras se espera su respuesta) y 'lista' (check + botón "Ver" que
  // lleva a la sección "Tus recetas", donde las nuevas aparecen primero
  // con el tag "Nuevo" -- ver renderMisRecetas).
  function bannerIA() {
    const banner = document.createElement('div');
    banner.className = 'card ia-banner mb';
    banner.style.cssText = 'background:linear-gradient(135deg, var(--primary-soft), var(--card))';
    if (iaEstado === 'generando') {
      banner.style.cssText += ';display:flex;align-items:center;gap:14px';
      banner.innerHTML = `
        <span style="font-size:1.8rem">🍳</span>
        <div style="flex:1;min-width:0">
          <div class="spread">
            <p style="font-weight:700">Generando ${iaCantidad === 1 ? 'receta' : `${iaCantidad} recetas`}…</p>
            <p class="small" id="ia-pct" style="font-weight:700">0%</p>
          </div>
          <div style="background:var(--border);border-radius:99px;height:6px;margin-top:6px;overflow:hidden">
            <div id="ia-fill" style="background:var(--accent);height:100%;width:0%;transition:width .3s ease-out"></div>
          </div>
        </div>`;
    } else {
      banner.classList.add('spread');
      banner.innerHTML = `
        <div class="row" style="gap:12px">
          <span style="font-size:1.6rem">✅</span>
          <p style="font-weight:700">¡Tu${iaCantidad === 1 ? '' : 's'} ${iaCantidad === 1 ? 'receta está' : `${iaCantidad} recetas están`} list${iaCantidad === 1 ? 'a' : 'as'}!</p>
        </div>
        <button type="button" class="btn sm" id="ia-ver">Ver</button>`;
      banner.querySelector('#ia-ver').addEventListener('click', () => {
        iaEstado = 'idle';
        drawBody();
        const seccion = body.querySelector('#tus-recetas');
        if (seccion) seccion.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    return banner;
  }

  // Paso 1: "¿Cuántas recetas quieres generar?" -- selector -/+, costo
  // total en vivo (COSTO_RECETA_IA por receta, ver store.js). Tope: 5 a la
  // vez (suficiente para no disparar el costo de la IA de un solo tirón) o
  // lo que alcance el saldo actual, lo que sea menor.
  const MAX_CANTIDAD_IA = 5;
  function abrirSelectorCantidadIA() {
    const saldo = getState().nutricoins || 0;
    if (saldo < COSTO_RECETA_IA) {
      toast(`Necesitas ${COSTO_RECETA_IA} NutriCoins para generar una receta.`);
      abrirComprarNutricoins();
      return;
    }
    const tope = Math.max(1, Math.min(MAX_CANTIDAD_IA, Math.floor(saldo / COSTO_RECETA_IA)));
    openModal((modal, closeFn) => {
      let cantidad = 1;
      modal.insertAdjacentHTML('beforeend', `
        <div class="center">
          <h2>¿Cuántas recetas quieres generar?</h2>
        </div>
        <div class="row mt" style="justify-content:center;align-items:center;gap:22px">
          <button type="button" class="icon-btn" id="cant-menos" aria-label="Menos">−</button>
          <div class="center" style="min-width:70px">
            <p id="cant-num" style="font-size:2.2rem;font-weight:800;line-height:1">1</p>
            <p class="small muted" id="cant-label">receta</p>
          </div>
          <button type="button" class="icon-btn" id="cant-mas" aria-label="Más">+</button>
        </div>
        <p class="small muted center mt" id="cant-costo">1 receta = ${COSTO_RECETA_IA} NutriCoins</p>
        <button type="button" class="btn full mt" id="cant-continuar">Continuar</button>`);

      const numEl = modal.querySelector('#cant-num');
      const labelEl = modal.querySelector('#cant-label');
      const costoEl = modal.querySelector('#cant-costo');
      function pintar() {
        numEl.textContent = cantidad;
        labelEl.textContent = cantidad === 1 ? 'receta' : 'recetas';
        costoEl.textContent = `${cantidad} ${cantidad === 1 ? 'receta' : 'recetas'} = ${cantidad * COSTO_RECETA_IA} NutriCoins`;
        modal.querySelector('#cant-menos').disabled = cantidad <= 1;
        modal.querySelector('#cant-mas').disabled = cantidad >= tope;
      }
      pintar();
      modal.querySelector('#cant-menos').addEventListener('click', () => { cantidad = Math.max(1, cantidad - 1); pintar(); });
      modal.querySelector('#cant-mas').addEventListener('click', () => { cantidad = Math.min(tope, cantidad + 1); pintar(); });
      modal.querySelector('#cant-continuar').addEventListener('click', () => {
        closeFn();
        abrirDescribirRecetaIA(cantidad);
      });
    });
  }

  // Paso 2: "Describe la receta que quieres" -- comida (dropdown) + notas
  // opcionales. Al generar, cierra el modal y vuelve al Recetario, donde
  // se ve el banner de progreso (bannerIA) -- la IA nunca se llama desde
  // dentro del modal.
  const NOTAS_MAX = 200;
  function abrirDescribirRecetaIA(cantidad) {
    openModal((modal, closeFn) => {
      let comidaElegida = mealFilter !== 'todas' ? mealFilter : MEALS[0].id;
      modal.insertAdjacentHTML('beforeend', `
        <div class="center">
          <h2>Describe la receta que quieres</h2>
          <p class="small muted mt">Menciona ingredientes, un plato específico, o ajusta el tiempo de preparación. Sin calorías ni macros.</p>
        </div>
        <div class="center mt" style="position:relative">
          <button type="button" class="chip small" id="ia-comida-btn"></button>
          <div id="ia-comida-menu" class="card hidden" style="position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);z-index:5;width:200px;padding:6px 14px;box-shadow:0 8px 24px rgba(8,18,15,0.18)"></div>
        </div>
        <div style="position:relative">
          <textarea id="ia-notas" class="auth-input mt" rows="5" maxlength="${NOTAS_MAX}" placeholder="Ej: con pollo, sin lácteos, algo rápido…" style="resize:none"></textarea>
          <p class="small muted" id="ia-contador" style="text-align:right;margin-top:-6px">${NOTAS_MAX} caracteres restantes</p>
        </div>
        <button type="button" class="btn full" id="ia-generar" style="display:flex;align-items:center;justify-content:center;gap:6px">Generar ${cantidad === 1 ? 'receta' : 'recetas'} · ${cantidad * COSTO_RECETA_IA} ${coinIcon(ORO_NUTRICOINS, 18)}</button>`);

      const { getComida } = montarSelectorComida(modal, modal.querySelector('#ia-comida-btn'), modal.querySelector('#ia-comida-menu'), comidaElegida);

      const notasEl = modal.querySelector('#ia-notas');
      const contador = modal.querySelector('#ia-contador');
      notasEl.addEventListener('input', () => {
        contador.textContent = `${NOTAS_MAX - notasEl.value.length} caracteres restantes`;
      });

      modal.querySelector('#ia-generar').addEventListener('click', () => {
        const notas = notasEl.value.trim();
        closeFn();
        generarRecetasInline(cantidad, getComida(), notas);
      });
    });
  }

  // "Crear manualmente" abre esta lista de 3 formas de hacerlo sin IA
  // generativa de cero (manual/foto/enlace) -- referencia de la usuaria
  // (captura de Fitia): filas grandes con ícono + título + descripción,
  // no botones sueltos en el grid del Recetario.
  function abrirSelectorMetodoCreacion() {
    openModal((modal, closeFn) => {
      modal.insertAdjacentHTML('beforeend', `
        <div class="center">
          <h2>Elige cómo<br>crear tu receta</h2>
        </div>
        <div class="metodo-crear-list mt">
          <button type="button" class="metodo-crear-row" id="metodo-manual">
            <span class="metodo-crear-icon">✏️</span>
            <span class="metodo-crear-text"><strong>Manual</strong><span class="small muted">Agrega ingredientes uno por uno</span></span>
          </button>
          <button type="button" class="metodo-crear-row" id="metodo-foto">
            <span class="metodo-crear-icon">${CAMERA_ICON}</span>
            <span class="metodo-crear-text"><strong>Desde una foto</strong><span class="small muted">De una receta escrita, o del plato ya preparado</span></span>
          </button>
          <button type="button" class="metodo-crear-row" id="metodo-enlace">
            <span class="metodo-crear-icon">🔗</span>
            <span class="metodo-crear-text"><strong>Desde un enlace</strong><span class="small muted">Pega el link de una receta real</span></span>
          </button>
        </div>`);
      // No se cierra esta modal al elegir un método -- se abre la
      // siguiente pantalla ENCIMA (openModal soporta modales apiladas,
      // ver modalLockCount en app.js). Si esa pantalla se cancela sin
      // generar nada, esta sigue abierta debajo y se ve de nuevo; solo se
      // cierra también (via closeFn, pasado a cada función) cuando el
      // método sí llega a generar/guardar algo de verdad.
      modal.querySelector('#metodo-manual').addEventListener('click', () => {
        abrirFormularioReceta(() => { closeFn(); drawBody(); });
      });
      modal.querySelector('#metodo-foto').addEventListener('click', () => {
        abrirCrearDesdeFoto(closeFn);
      });
      modal.querySelector('#metodo-enlace').addEventListener('click', () => {
        abrirCrearDesdeEnlace(closeFn);
      });
    });
  }

  // "Desde una foto": cámara en vivo dentro de la app, mismo lenguaje
  // visual que la cámara de "¿Qué comiste?" (ver pantallaCamara en
  // mealLogModal.js) -- referencia de la usuaria (video de Fitia): abre
  // directo a la cámara, sin pantalla previa. La comida se asigna sola
  // (pestaña activa del Recetario), sin pedirla aparte.
  // closeSelector: cierra también "Elige cómo crear tu receta" (la modal
  // de abajo, apilada) -- solo se llama en el camino de ÉXITO (foto ya
  // capturada/elegida, lista para generar). Cancelar o un error en el
  // procesamiento solo cierra esta pantalla y deja el selector visible.
  function abrirCrearDesdeFoto(closeSelector) {
    const saldo = getState().nutricoins || 0;
    if (saldo < COSTO_RECETA_IA) {
      toast(`Necesitas ${COSTO_RECETA_IA} NutriCoins para generar una receta.`);
      abrirComprarNutricoins();
      return;
    }
    const comida = mealFilter !== 'todas' ? mealFilter : MEALS[0].id;
    let stream = null;
    function detenerCamara() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;
    document.body.appendChild(fileInput);

    openModal((modal, closeFn) => {
      function cerrarTodo() {
        detenerCamara();
        modal.parentElement?.classList.remove('cam-fullscreen');
        fileInput.remove();
        closeFn();
      }

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
          const { base64, mediaType } = await comprimirFotoReceta(file);
          cerrarTodo();
          closeSelector();
          generarUnaConIA(comida, 'foto', () => generarRecetaDesdeFoto(comida, base64, mediaType));
        } catch (err) {
          toast(err.message || 'No se pudo procesar la foto.');
          cerrarTodo();
        }
      });

      modal.innerHTML = `
        <div class="camera-top"><button type="button" class="camera-cancelar" id="rf-cam-cancelar">Cancelar</button></div>
        <p class="camera-instruccion">Toma una foto de una receta escrita, o del plato ya preparado</p>
        <div class="camera-wrap">
          <video id="rf-cam-video" autoplay playsinline muted></video>
          <div class="camera-frame"></div>
        </div>
        <div class="camera-controls">
          <button type="button" class="camera-icon-btn" id="rf-cam-galeria" aria-label="Elegir de la galería">🖼️</button>
          <button type="button" id="rf-cam-shutter" class="camera-shutter" aria-label="Tomar foto"></button>
          <span class="camera-icon-btn" style="visibility:hidden" aria-hidden="true"></span>
        </div>`;
      // Fullscreen (fondo negro de borde a borde) recién ahora -- modal aún
      // no tenía padre cuando este callback empezó a correr (openModal lo
      // engancha al backdrop justo después de esta llamada).
      setTimeout(() => modal.parentElement?.classList.add('cam-fullscreen'), 0);

      modal.querySelector('#rf-cam-cancelar').addEventListener('click', cerrarTodo);
      modal.querySelector('#rf-cam-galeria').addEventListener('click', () => {
        detenerCamara();
        modal.parentElement?.classList.remove('cam-fullscreen');
        fileInput.click();
      });

      const video = modal.querySelector('#rf-cam-video');
      (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
          video.srcObject = stream;
        } catch {
          modal.parentElement?.classList.remove('cam-fullscreen');
          toast('No pudimos abrir la cámara. Elige una foto de tu galería.');
          fileInput.click();
        }
      })();

      modal.querySelector('#rf-cam-shutter').addEventListener('click', () => {
        const w = video.videoWidth, h = video.videoHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(video, 0, 0, w, h);
        canvas.toBlob((blob) => {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          cerrarTodo();
          closeSelector();
          generarUnaConIA(comida, 'foto', () => generarRecetaDesdeFoto(comida, dataUrl.split(',')[1], 'image/jpeg'));
        }, 'image/jpeg', 0.85);
      });

      // Si se cierra por otra vía (tocar fuera del backdrop), apaga la
      // cámara igual -- sin esto la lucecita queda prendida.
      const obs = new MutationObserver(() => {
        if (!modal.isConnected) { detenerCamara(); fileInput.remove(); obs.disconnect(); }
      });
      obs.observe(document.body, { childList: true });
    });
  }

  // "Desde un enlace": pegar la URL de una receta real -- el texto de la
  // página se descarga y estructura en el servidor (generate-recipe),
  // nunca en el navegador (CORS/CSP no lo permitirían de todas formas).
  // Mismo diseño que la referencia de la usuaria: título "Pega un enlace",
  // input + botón Pegar (portapapeles), aviso de qué enlaces sirven, y un
  // botón "Importar receta" que se activa solo con algo escrito.
  function abrirCrearDesdeEnlace(closeSelector) {
    const saldo = getState().nutricoins || 0;
    if (saldo < COSTO_RECETA_IA) {
      toast(`Necesitas ${COSTO_RECETA_IA} NutriCoins para generar una receta.`);
      abrirComprarNutricoins();
      return;
    }
    const comida = mealFilter !== 'todas' ? mealFilter : MEALS[0].id;
    openModal((modal, closeFn) => {
      modal.insertAdjacentHTML('beforeend', `
        <div class="center">
          <h2>Pega un enlace</h2>
        </div>
        <div class="row mt" style="gap:8px">
          <input type="url" id="enlace-url" class="auth-input" placeholder="https://www.example.com" inputmode="url" style="margin:0;flex:1;min-width:0">
          <button type="button" class="btn ghost sm" id="enlace-pegar" style="flex:none">📋 Pegar</button>
        </div>
        <p class="small muted mt center">Enlaces soportados: TikTok, Instagram, YouTube Shorts y sitios web.</p>
        <button type="button" class="btn full mt" id="enlace-generar" disabled style="display:flex;align-items:center;justify-content:center;gap:6px">Importar receta · ${COSTO_RECETA_IA} ${coinIcon(ORO_NUTRICOINS, 18)}</button>`);

      const urlInput = modal.querySelector('#enlace-url');
      const generarBtn = modal.querySelector('#enlace-generar');
      urlInput.addEventListener('input', () => { generarBtn.disabled = !urlInput.value.trim(); });

      modal.querySelector('#enlace-pegar').addEventListener('click', async () => {
        try {
          const texto = await navigator.clipboard.readText();
          if (texto) {
            urlInput.value = texto.trim();
            generarBtn.disabled = !urlInput.value.trim();
          }
        } catch {
          toast('No pudimos leer el portapapeles. Pega el enlace manualmente.');
        }
      });

      generarBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) return;
        closeFn();
        closeSelector();
        generarUnaConIA(comida, 'enlace', () => generarRecetaDesdeEnlace(comida, url));
      });
    });
  }

  // Comparte el mismo banner/estado de progreso que generarRecetasInline
  // (bannerIA, iaEstado/iaCantidad/iaCompletadas), pero para UN resultado
  // que llega de una sola llamada (foto o enlace) en vez de un lote.
  async function generarUnaConIA(comida, origen, llamada) {
    iaEstado = 'generando';
    iaCantidad = 1;
    iaCompletadas = 0;
    drawBody();

    let segPct = 0;
    clearInterval(iaTimer);
    iaTimer = setInterval(() => {
      segPct = Math.min(90, segPct + (90 - segPct) * 0.15 + 1);
      const fill = body.querySelector('#ia-fill');
      const label = body.querySelector('#ia-pct');
      if (fill) fill.style.width = `${Math.round(segPct)}%`;
      if (label) label.textContent = `${Math.round(segPct)}%`;
    }, 350);

    try {
      const receta = await llamada();
      clearInterval(iaTimer);
      gastarNutricoins(COSTO_RECETA_IA);
      const nutricoinsBtn = document.querySelector('#hs-nutricoins');
      if (nutricoinsBtn) {
        const saldo = getState().nutricoins || 0;
        nutricoinsBtn.classList.toggle('sin-saldo', saldo <= 0);
        nutricoinsBtn.innerHTML = `${coinIcon(saldo > 0 ? ORO_NUTRICOINS : PLATA_NUTRICOINS, 15)}<span class="value">${saldo}</span>`;
      }
      const nueva = agregarRecetaPropia({ ...receta, comida, origen });
      nuevasIds.add(nueva.id);
      iaCompletadas = 1;
      iaEstado = 'lista';
      drawBody();
    } catch (e) {
      clearInterval(iaTimer);
      iaEstado = 'idle';
      drawBody();
      if (e.code === 'nutricoins_insuficientes') abrirComprarNutricoins();
      else toast(e.message || 'No pudimos generar la receta.');
    }
  }

  function generarRecetasInline(cantidad, comida, notas) {
    if (iaEstado === 'generando') return;
    iaEstado = 'generando';
    iaCantidad = cantidad;
    iaCompletadas = 0;
    drawBody();

    let segPct = 0; // progreso animado dentro de la receta en curso (0-100)
    clearInterval(iaTimer);
    iaTimer = setInterval(() => {
      // Avanza rápido al inicio y se frena cerca del 90% de SU tramo --
      // nunca llega a 100% por sí solo, eso lo marca la respuesta real.
      segPct = Math.min(90, segPct + (90 - segPct) * 0.15 + 1);
      pintarProgreso();
    }, 350);

    function pintarProgreso() {
      const pct = ((iaCompletadas + segPct / 100) / cantidad) * 100;
      const fill = body.querySelector('#ia-fill');
      const label = body.querySelector('#ia-pct');
      if (fill) fill.style.width = `${Math.round(pct)}%`;
      if (label) label.textContent = `${Math.round(pct)}%`;
    }

    // Nombres a evitar: las que la usuaria ya tiene guardadas para esta
    // comida + las que ya salieron en esta misma tanda -- sin esto, pedir
    // varias recetas de una vez (o volver a tocar "Crear con IA" otro
    // día) sin escribir ninguna nota tendía a repetir siempre el mismo
    // plato "obvio" para esa comida.
    const nombresExistentes = (getState().misRecetas || [])
      .filter((r) => r.comida === comida)
      .map((r) => r.nombre);

    async function generarUna() {
      try {
        const receta = await generarRecetaIA(comida, notas, nombresExistentes);
        gastarNutricoins(COSTO_RECETA_IA);
        // header() no es reactivo -- pinta el saldo una sola vez al montar
        // la vista, así que sin este parche el número del header se queda
        // desactualizado hasta la próxima navegación (mismo parche que ya
        // existe para gemas/escudos en app.js tras comprar una Pausa de Ruta).
        const nutricoinsBtn = document.querySelector('#hs-nutricoins');
        if (nutricoinsBtn) {
          const saldo = getState().nutricoins || 0;
          nutricoinsBtn.classList.toggle('sin-saldo', saldo <= 0);
          nutricoinsBtn.innerHTML = `${coinIcon(saldo > 0 ? ORO_NUTRICOINS : PLATA_NUTRICOINS, 15)}<span class="value">${saldo}</span>`;
        }
        const nueva = agregarRecetaPropia({ ...receta, comida, origen: 'ia' });
        nuevasIds.add(nueva.id);
        nombresExistentes.push(nueva.nombre);
        iaCompletadas++;
        segPct = 0;
        pintarProgreso();
        if (iaCompletadas < cantidad) {
          await generarUna();
        } else {
          clearInterval(iaTimer);
          iaEstado = 'lista';
          drawBody();
        }
      } catch (e) {
        clearInterval(iaTimer);
        iaEstado = 'idle';
        drawBody();
        if (e.code === 'nutricoins_insuficientes') abrirComprarNutricoins();
        else toast((e.message || 'No pudimos generar la receta.') + (iaCompletadas > 0 ? ` Se generaron ${iaCompletadas}.` : ''));
      }
    }
    generarUna();
  }

  function drawRecipes() {
    const { user, favoritas } = getState();

    // Las dos formas de agregar una receta propia (como en Fitia), sutiles
    // y del mismo tamaño una junto a la otra -- nunca muestran calorías ni
    // macros. Siempre visibles (la búsqueda ya no ocupa este espacio: vive
    // sobrepuesta encima de las pestañas Recetario/Lista de compras, ver
    // tabsRow más arriba, para no mover nada de lo que hay debajo).
    const crear = document.createElement('div');
    crear.className = 'row mb';
    crear.style.cssText = 'gap:8px;align-items:stretch';
    crear.innerHTML = `
      <button type="button" class="crear-receta-btn" id="crear-ia" style="flex:1;min-width:0;cursor:pointer">
        <span class="crear-receta-emoji">✨</span>
        <span>Crear con IA</span>
      </button>
      <button type="button" class="crear-receta-btn" id="crear-manual" style="flex:1;min-width:0;cursor:pointer">
        <span class="crear-receta-emoji">➕</span>
        <span>Crear manualmente</span>
      </button>`;
    crear.querySelector('#crear-ia').addEventListener('click', abrirSelectorCantidadIA);
    crear.querySelector('#crear-manual').addEventListener('click', abrirSelectorMetodoCreacion);
    body.appendChild(crear);

    if (iaEstado !== 'idle') body.appendChild(bannerIA());

    const note = document.createElement('p');
    note.className = 'muted small center mt mb';
    note.textContent = 'El semáforo se calcula según tus perfiles activos: verde = recomendado, amarillo = con moderación.';
    body.appendChild(note);

    // Barra de filtros: 3 controles del mismo tamaño en una sola línea
    // (Ordenar / Comida / Preferidos). Ordenar y Comida son <select>
    // nativos con la piel de .btn (dropdown real del sistema al tocar, no
    // un modal de pantalla completa) -- Preferidos sigue siendo un botón
    // simple porque solo alterna encendido/apagado, no elige entre varias.
    const MEAL_OPTS = [{ id: 'todas', nombre: 'Todas', emoji: '✨' }, ...MEALS];
    const filters = document.createElement('div');
    filters.className = 'mb';
    filters.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px';
    filters.innerHTML = `
      <select class="filtro-select" id="sel-ordenar" aria-label="Ordenar por">
        ${ORDENES.map((o) => `<option value="${o.id}" ${orden === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
      <select class="filtro-select" id="sel-comida" aria-label="Filtrar por comida">
        ${MEAL_OPTS.map((o) => `<option value="${o.id}" ${mealFilter === o.id ? 'selected' : ''}>${o.emoji} ${o.nombre}</option>`).join('')}
      </select>
      <button type="button" class="filtro-select${soloFavoritas ? ' selected' : ''}" id="btn-preferidos"><span class="filtro-txt">⭐ Preferidos</span></button>`;
    filters.querySelectorAll('.filtro-txt').forEach((s) => {
      s.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%';
    });
    filters.querySelector('#sel-ordenar').addEventListener('change', (e) => { orden = e.target.value; drawBody(); });
    filters.querySelector('#sel-comida').addEventListener('change', (e) => { mealFilter = e.target.value; drawBody(); });
    filters.querySelector('#btn-preferidos').addEventListener('click', () => {
      soloFavoritas = !soloFavoritas;
      drawBody();
    });
    body.appendChild(filters);

    let list = RECIPES
      .filter((r) => mealFilter === 'todas' || r.comida === mealFilter)
      .filter((r) => isRecipeAvailable(r, user.exclusiones, user.exclusionesOtro))
      .filter((r) => matchesSearch(r, busqueda))
      .filter((r) => !soloFavoritas || (favoritas || []).includes(r.id));

    // "Mis recetas" -- el orden 'mias' no reordena el catálogo curado, lo
    // OCULTA por completo (nada de RECIPES en pantalla), para dejar ver
    // solo lo que la usuaria creó (ver renderMisRecetas() más abajo, que
    // siempre se pinta al final de drawBody).
    const soloMias = orden === 'mias';
    if (soloMias) {
      list = [];
    } else if (orden === 'nombre') {
      list = [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    } else if (orden === 'rapido') {
      list = [...list].sort((a, b) => (b.etiquetas?.includes('rapido') ? 1 : 0) - (a.etiquetas?.includes('rapido') ? 1 : 0));
    } else {
      // Primero lo más afín a tu diagnóstico (mismo criterio que arma el
      // menú del día) — así lo gratis y lo que aparece primero al explorar
      // es lo más relevante para ti, no un orden fijo del archivo.
      list = rankRecipes(list, user.perfiles);
    }

    if (!list.length && !soloMias) {
      const empty = document.createElement('div');
      empty.className = 'card';
      empty.innerHTML = `<p>${busqueda ? `No encontramos recetas con "${busqueda}".` : 'No hay recetas disponibles con tus exclusiones actuales en esta categoría.'}</p>`;
      body.appendChild(empty);
    }
    const premium = isPremium();
    const meal = MEALS.reduce((m, x) => (m[x.id] = x, m), {});

    // Separa visualmente lo que de verdad está pensado para tu diagnóstico
    // de lo demás -- solo tiene sentido con el orden "Recomendadas"
    // (rankRecipes ya las prioriza); con Nombre o Más rápidas la usuaria
    // eligió ver todo en un único orden propio, así que va en un solo
    // grupo sin la división. El índice de bloqueo (FREE_RECIPE_LIMIT)
    // sigue contando de corrido sobre toda la lista combinada.
    const recomendadas = orden === 'recomendadas' ? list.filter((r) => r.apto.some((p) => user.perfiles.includes(p))) : list;
    const otras = orden === 'recomendadas' ? list.filter((r) => !r.apto.some((p) => user.perfiles.includes(p))) : [];
    let globalIndex = 0;

    // Recetas propias que sí cumplen con el perfil de salud activo (ver
    // trafficLightRecetaPropia en menu.js) se mezclan dentro de
    // "Recomendadas para tu perfil", con su etiqueta "Tuya" -- solo tiene
    // sentido con el orden "Recomendadas" (el mismo que agrupa el
    // catálogo así); en "Mis recetas" todas van juntas sin importar el
    // semáforo, y en Nombre/Más rápidas no hay esta separación.
    const { misRecetas } = getState();
    let propiasFiltradas = (misRecetas || [])
      .filter((r) => mealFilter === 'todas' || r.comida === mealFilter)
      .filter((r) => !busqueda || r.nombre.toLowerCase().includes(busqueda.toLowerCase()))
      .filter((r) => !soloFavoritas || (favoritas || []).includes(r.id));
    if (nuevasIds.size) {
      propiasFiltradas = [...propiasFiltradas].sort((a, b) => (nuevasIds.has(b.id) ? 1 : 0) - (nuevasIds.has(a.id) ? 1 : 0));
    }
    const propiasVerdes = orden === 'recomendadas' ? propiasFiltradas.filter((r) => trafficLightRecetaPropia(r, user.perfiles) === 'verde') : [];
    const propiasIdsVerdes = new Set(propiasVerdes.map((r) => r.id));
    const propiasResto = soloMias ? propiasFiltradas : propiasFiltradas.filter((r) => !propiasIdsVerdes.has(r.id));

    // Tarjeta de una receta propia -- comparte look con el catálogo (plato,
    // vapor, aro de semáforo ya evaluado contra el perfil activo, ver
    // trafficLightRecetaPropia) pero con su propio click (abre
    // abrirRecetaPropia, no openRecipe) y su etiqueta de origen ("Tuya"/
    // "Con IA"/etc en vez de las etiquetas del catálogo).
    function crearTarjetaPropia(r) {
      const esFavorita = (favoritas || []).includes(r.id);
      const esNueva = nuevasIds.has(r.id);
      const light = trafficLightRecetaPropia(r, user.perfiles);
      const item = document.createElement('button');
      item.className = 'recipe-card';
      item.innerHTML = `
        ${esNueva ? '<span class="recipe-nuevo-tag">Nuevo</span>' : ''}
        <span class="recipe-fav" aria-label="${esFavorita ? 'Quitar de preferidos' : 'Marcar como preferida'}">${esFavorita ? '⭐' : '☆'}</span>
        <div class="recipe-plate">
          ${HOT_MEALS.has(r.comida) ? '<span class="steam"><span></span><span></span><span></span></span>' : ''}
          ${esc(r.emoji)}
          <span class="garnish">${meal[r.comida]?.emoji || ''}</span>
          <span class="semaforo-ring ${light}" title="Semáforo: ${light}"></span>
        </div>
        <div class="recipe-title">${esc(r.nombre)}</div>
        <div class="recipe-desc">${esc(r.descripcion || 'Receta tuya')}</div>
        <div class="recipe-tags"><span class="recipe-tag">${origenLabel(r)}</span></div>`;
      item.querySelector('.recipe-fav').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorita(r.id);
        drawBody();
      });
      item.addEventListener('click', () => {
        nuevasIds.delete(r.id);
        abrirRecetaPropia(r, () => drawBody());
      });
      return item;
    }

    function renderGroup(items, label, extraPropias = []) {
      if (!items.length && !extraPropias.length) return;
      if (label) {
        const divider = document.createElement('div');
        divider.className = 'recipe-section-divider';
        divider.innerHTML = `<span>${label}</span>`;
        body.appendChild(divider);
      }
      const grid = document.createElement('div');
      grid.className = 'recipe-grid';
      for (const r of items) {
        const i = globalIndex++;
        const locked = !premium && i >= FREE_RECIPE_LIMIT;
        const light = trafficLight(r, user.perfiles);
        const shown = displayRecipe(r, user.exclusiones);
        const tags = (r.etiquetas || []).slice(0, 2).map((t) => `<span class="recipe-tag">${TAG_LABELS[t] || t}</span>`).join('');
        const esFavorita = (favoritas || []).includes(r.id);
        const item = document.createElement('button');
        item.className = 'recipe-card' + (locked ? ' locked' : '');
        item.innerHTML = `
          <span class="recipe-fav" aria-label="${esFavorita ? 'Quitar de preferidos' : 'Marcar como preferida'}">${esFavorita ? '⭐' : '☆'}</span>
          <div class="recipe-plate">
            ${HOT_MEALS.has(r.comida) ? '<span class="steam"><span></span><span></span><span></span></span>' : ''}
            ${shown.emoji}
            <span class="garnish">${meal[r.comida]?.emoji || ''}</span>
            ${locked ? '' : `<span class="semaforo-ring ${light}" title="Semáforo: ${light}"></span>`}
          </div>
          <div class="recipe-title">${shown.nombre}</div>
          <div class="recipe-desc${locked ? ' lesson-blur' : ''}">${r.descripcion}</div>
          ${locked ? '<div class="recipe-lock">🔒 Premium</div>' : `<div class="recipe-tags">${tags}</div>`}`;
        item.querySelector('.recipe-fav').addEventListener('click', (e) => {
          e.stopPropagation();
          toggleFavorita(r.id);
          drawBody();
        });
        item.addEventListener('click', () => locked ? navigate('plans') : openRecipe(r));
        grid.appendChild(item);
      }
      for (const r of extraPropias) grid.appendChild(crearTarjetaPropia(r));
      body.appendChild(grid);
    }

    // "Tus recetas" -- las que la usuaria creó a mano o con IA y NO
    // entraron ya en "Recomendadas para tu perfil" (ver propiasVerdes
    // arriba). Anidada aquí (no al nivel de drawRecipes) porque necesita
    // crearTarjetaPropia, definida justo arriba.
    function renderMisRecetas(propias) {
      if (!propias.length) return false;

      const divider = document.createElement('div');
      divider.className = 'recipe-section-divider';
      divider.id = 'tus-recetas';
      divider.innerHTML = '<span>📝 Tus recetas</span>';
      body.appendChild(divider);

      const grid = document.createElement('div');
      grid.className = 'recipe-grid';
      for (const r of propias) {
        grid.appendChild(crearTarjetaPropia(r));
      }
      body.appendChild(grid);
      return true;
    }

    // El título "Recomendadas para tu perfil" debe verse siempre que el
    // orden activo sea justo ese, haya o no una segunda sección de
    // "Otras recetas" debajo -- antes solo se mostraba si AMBOS grupos
    // tenían contenido, así que con un perfil donde todo el catálogo
    // calificaba como apto (sin ninguna "otra"), el título desaparecía
    // por completo aunque la sección sí existiera.
    const hayRecomendadas = recomendadas.length > 0 || propiasVerdes.length > 0;
    renderGroup(recomendadas, orden === 'recomendadas' && hayRecomendadas ? '🌿 Recomendadas para tu perfil' : null, propiasVerdes);
    renderGroup(otras, otras.length ? 'Otras recetas' : null);

    const huboMias = renderMisRecetas(propiasResto);
    if (soloMias && !huboMias) {
      const empty = document.createElement('div');
      empty.className = 'card';
      const tieneAlgunaPropia = (getState().misRecetas || []).length > 0;
      empty.innerHTML = `<p>${tieneAlgunaPropia
        ? 'Ninguna de tus recetas coincide con este filtro.'
        : 'Aún no has creado ninguna receta. Usa "Crear con IA" o "Crear manualmente" arriba.'}</p>`;
      body.appendChild(empty);
    }
  }

  const CATEGORIA_EMOJI = { Frutas: '🍎', Verduras: '🥦', Proteínas: '🍗', Granos: '🌾', Lácteos: '🥛', Otros: '🧂' };

  // Comparte la lista como texto plano (Web Share nativo si el dispositivo
  // lo soporta; si no, la copia al portapapeles) — nunca sube nada a un
  // servidor ni genera una imagen, solo texto.
  // Cantidad real sumada (ej. "3 huevos") cuando existe; si no, la nota de
  // en cuántos días aparece — usado tanto al pintar la fila como al armar
  // el texto de "Compartir", para que digan siempre lo mismo.
  function textoItem(it, esHoy) {
    if (esHoy) return it.texto;
    if (it.resto && it.cantidadTotal) return textoConCantidad(it.cantidadTotal, it.resto, getState().user.unidades);
    return `${it.texto} · ${it.count}× (${[...new Set(it.dias)].slice(0, 6).join(', ')})`;
  }

  async function compartirLista(grupos, tituloCard, esHoy) {
    const texto = grupos.map(({ categoria, items: itemsCat }) =>
      `${CATEGORIA_EMOJI[categoria] || ''} ${categoria.toUpperCase()}\n${itemsCat.map((it) => `• ${textoItem(it, esHoy)}`).join('\n')}`
    ).join('\n\n');
    const contenido = `${tituloCard.replace(/^🛒\s*/, '')}\n\n${texto}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Mi lista de compras — NutriRuta', text: contenido }); } catch { /* la usuaria canceló el share, no es un error */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(contenido);
      toast('Lista copiada — pégala donde quieras 📋');
    } catch {
      toast('No se pudo copiar automáticamente. Copia la lista a mano.');
    }
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

    let items, tituloCard, sub;
    const esHoy = rango === 'hoy';
    if (esHoy) {
      items = shoppingList();
      tituloCard = '🛒 Compras para tu menú de hoy';
      sub = 'Generada automáticamente desde tu menú del día.';
    } else {
      const dias = rango === 'semana' ? 7 : 30;
      items = rangeShoppingList(dias);
      tituloCard = `🛒 Compras para ${rango === 'semana' ? 'esta semana' : 'este mes'}`;
      sub = `Proyectada desde tu menú de los próximos ${dias} días, con la cantidad ya sumada cuando la conocemos. Para lo que no tiene una medida exacta (ej. "al gusto") te mostramos en cuántos días aparece, como guía.`;
    }
    card.innerHTML = `<h2>${tituloCard}</h2><p class="small mb">${sub}</p>`;

    // Agrupada por categoría (fruta/verdura/proteína/...) en vez de una
    // lista plana — más fácil de recorrer por pasillo del súper.
    const grupos = agruparPorCategoria(items);
    for (const { categoria, items: itemsCat } of grupos) {
      const h = document.createElement('h3');
      h.className = 'mt';
      h.style.cssText = 'font-size:0.78rem;color:var(--primary-dark);text-transform:uppercase;letter-spacing:.04em';
      h.textContent = `${CATEGORIA_EMOJI[categoria] || ''} ${categoria}`;
      card.appendChild(h);
      for (const it of itemsCat) {
        const row = document.createElement('div');
        const claveGuardado = it.resto || it.texto;
        const done = !!compras[claveGuardado];
        row.className = 'shop-item' + (done ? ' done' : '');
        // Con cantidad real sumada (ej. "3 huevos") no hace falta el "×N
        // días" -- el número YA es la cantidad a comprar. Sin cantidad
        // reconocida (ej. "Canela al gusto"), se sigue mostrando en cuántos
        // días aparece, como guía en su lugar.
        let textoPrincipal = it.texto;
        let extra = '';
        if (!esHoy) {
          if (it.resto && it.cantidadTotal) {
            textoPrincipal = textoConCantidad(it.cantidadTotal, it.resto, getState().user.unidades);
          } else {
            extra = ` <span class="muted small">· ${it.count}× (${[...new Set(it.dias)].slice(0, 6).join(', ')})</span>`;
          }
        }
        row.innerHTML = `<input type="checkbox" ${done ? 'checked' : ''}><span>${textoPrincipal}${extra}</span>`;
        row.querySelector('input').addEventListener('change', (e) => {
          setState({ compras: { ...getState().compras, [claveGuardado]: e.target.checked } });
          row.classList.toggle('done', e.target.checked);
        });
        card.appendChild(row);
      }
    }

    if (items.length) {
      const shareBtn = document.createElement('button');
      shareBtn.className = 'btn ghost sm full mt';
      shareBtn.textContent = '📤 Compartir lista';
      shareBtn.addEventListener('click', () => compartirLista(grupos, tituloCard, esHoy));
      card.appendChild(shareBtn);
    }
    body.appendChild(card);
  }

  drawTabs();
  drawBody();
  container.appendChild(tabsRow);
  container.appendChild(body);
}
