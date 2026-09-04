// Estado persistente en localStorage + sincronización con Supabase.
import { fetchProfile, pushProfileState } from './supabase-client.js';
import { DAILY_STEPS } from './data/dailySteps.js';
import { SANA_OPENERS } from './data/sanaOpeners.js';

const KEY = 'nutriruta-state-v1';

// Default exportado (no solo interno a DEFAULT_STATE): loadFromKey() abajo
// hace un merge SUPERFICIAL a nivel raíz con localStorage/la nube, así que
// una cuenta creada antes de que existiera horaComidas tiene un objeto
// `user` guardado que reemplaza por completo al default y NO trae este
// campo. Quien lo lea (dashboard.js) necesita este mismo default como
// fallback por-comida, no un `0` genérico — con `0` la ventana horaria de
// "ahora" queda rota (todo el día cae en la última comida).
export const DEFAULT_HORA_COMIDAS = { desayuno: 7, media_manana: 10, almuerzo: 12, media_tarde: 16, cena: 19 };

const DEFAULT_STATE = {
  onboarded: false,
  user: {
    nombre: '',
    objetivos: [],
    objetivosOtro: [],     // metas propias, escritas a mano (no estaban en la lista)
    perfiles: [],
    exclusiones: [],
    exclusionesOtro: [],   // alimentos que no consume, escritos a mano (ej. "cilantro")
    habitosDificiles: [],
    motivacion: '',
    origen: '',   // como se entero de NutriRuta (marketing, ver ORIGEN en quiz.js)
    origenOtroTexto: '',
    actividad: 'medio',
    azucarFreq: 'a_veces',
    alcoholFreq: 'nunca',
    colonPredominante: null,
    pesoKg: null,           // opcional: junto con sexo, afina la meta de agua
    sexo: null,             // 'mujer' | 'hombre' | null -- opcional, afina la meta de agua (ver getWaterGoal)
    edad: null,             // opcional, aun sin usarse en ningun calculo -- solo contexto (ver nota en quiz.js)
    estaturaCm: null,       // opcional, aun sin usarse en ningun calculo -- capturado para uso futuro (ver nota en quiz.js)
    trackearPeso: false,    // opcional y apagado por defecto: registro de peso en el tiempo
    // Hora de inicio (24h) real de cada comida — antes era una franja fija
    // igual para todo el mundo (7/10/12/16/19). Cada quien la ajusta a su
    // rutina real en Ajustes; estos valores son el default si nunca la toca.
    horaComidas: { ...DEFAULT_HORA_COMIDAS },
    comidasActivas: {},     // { [mealId]: false } solo para las desactivadas -- ausente = incluida (ver mealsActivas en menu.js)
    tonoSusana: 'calida',   // 'calida' | 'motivadora' | 'directa' — cómo le habla SuSana, ver ai-assistant
    contextoSusana: '',     // texto libre opcional, ej. "no hago ejercicio hace meses" — contexto extra que SuSana suma al de siempre (perfiles/síntomas/racha), nunca lo reemplaza
    memorias: [],           // { id, texto, fecha } — datos puntuales que ella le pidió a SuSana recordar (ver assistant.js), se suman al contexto de ai-assistant
    referidoPor: null,      // código de quien la invitó (capturado de "?ref=" en app.js), ver hotmart-webhook/referral-check
    unidades: 'metrico',    // 'metrico' | 'imperial' — ver textoConCantidad en menu.js
    idiomaInterfaz: 'es'    // 'es' | 'en' — ver i18n.js (t()). Las recetas siguen solo en español por ahora.
  },
  agua: { fecha: '', vasos: 0 },
  comidasSeguidas: { fecha: '', ids: [] }, // recetas del menú real de hoy que se abrieron — para auto-marcar "seguí el menú"
  habitos: { fecha: '', checks: {} },
  racha: { actual: 0, mejor: 0, ultimoDia: '' },
  diasCumplidos: [],           // fechas ISO en que se completó el día
  antojos: [],                 // { fecha, hora, tipo, resultado }
  sintomas: [],                 // { fecha, hora, tipo, disparador }
  pesos: [],                    // { fecha, kg } — solo si user.trackearPeso está activo
  historialDiario: [],          // rollup diario para las gráficas de progreso
  checkins: [],                 // { fecha, hora, animo, antojosImpulsos, menuExperiencia, notas, compartir }
  checkinPospuesto: null,       // última fecha en que se pospuso el check-in
  logros: [],                  // ids de logros desbloqueados
  menuOverrides: {},           // { 'fecha|comida': n } desplazamiento al cambiar receta
  compras: {},                 // { itemId: true } marcados en lista de compras
  notifPrefs: { plan: true, comidas: true, agua: true }, // qué tipos de aviso push recibir
  pasoHechos: [],               // fechas ISO en que se marcó "Tu paso de hoy" como hecho
  escudos: 0,                   // Pausas de Ruta disponibles (máx maxEscudos())
  gemas: 0,                     // moneda simple: se gana al completar el día/semana, se gasta en escudos extra
  nutricoins: 450,               // moneda que SÍ se compra con dinero (ver "Comprar NutriCoins" en Ajustes) -- nunca compra Pausas de Ruta ni nada que reemplace constancia real, solo extras (preguntas de más a SuSana, cosas así). Gemas y NutriCoins conviven pero no se mezclan. Toda cuenta arranca con 450 de regalo.
  energiaRuta: 0,                // acumulado histórico: constancia y cuidado de hábitos, no calorías ni peso
  kmRuta: 0,                     // acompaña a energiaRuta, mismo espíritu ("cuánto ha recorrido tu Ruta")
  primerosPasos: { cerrado: false, minimizado: false }, // checklist de onboarding, solo cuentas nuevas
  sonidoActivado: true,         // chime al completar una micro-acción; silenciable en Ajustes
  rutiOculto: false,            // modo minimalista: oculta la ilustración de Ruti donde aparece
  diasCongelados: [],           // fechas ISO cubiertas por una Pausa de Ruta (racha "congelada", no rota)
  reflexionesHabitos: {},        // { fecha: texto } — la frase real que se pide al completar el 3er hábito del día
  comidasRegistradas: {},          // { 'fecha|mealId': { alimentos: [texto], fuente: 'foto'|'voz'|'texto', hora } } — lo que la usuaria dijo que REALMENTE comió, no la sugerencia del menú
  favoritas: []                   // ids de RECIPES marcadas con la estrella en el Recetario (ver planner.js)
};

// Cuántos hábitos diarios existen (debe coincidir con DAILY_HABITS en dashboard.js).
const TOTAL_HABITOS_DIA = 5;

// La llave de localStorage se aísla por cuenta (user.id) una vez hay sesión.
// Sin esto, en un dispositivo compartido/de pruebas, el progreso cacheado de
// una cuenta puede terminar subiéndose al perfil de otra al iniciar sesión
// (no solo al registrarse) — fue la causa real de que aparecieran antojos,
// racha o plan de 7 días de otra cuenta en una recién creada.
function keyFor(userId) { return userId ? `${KEY}:${userId}` : KEY; }
let activeKey = KEY;

function loadFromKey(key) {
  try {
    // Migrar el estado guardado bajo nombres anteriores de la app.
    let raw = localStorage.getItem(key);
    if (!raw && key === KEY) {
      for (const oldKey of ['savibra-state-v1', 'nutralma-state-v1']) {
        const old = localStorage.getItem(oldKey);
        if (old) { raw = old; localStorage.setItem(key, old); localStorage.removeItem(oldKey); break; }
      }
    }
    if (!raw) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

let state = loadFromKey(activeKey);

export function getState() { return state; }

export function setState(patch) {
  state = { ...state, ...patch };
  localStorage.setItem(activeKey, JSON.stringify(state));
  scheduleCloudPush();
}

export function resetState() {
  state = structuredClone(DEFAULT_STATE);
  localStorage.removeItem(activeKey);
  activeKey = KEY;
}

// --- Tema (claro/oscuro/sistema) ---
// Preferencia del dispositivo/navegador, no un dato de salud: se guarda en
// su propia llave de localStorage (no en el estado por cuenta) para que
// funcione ANTES de iniciar sesión y no se borre con resetState()/logout.
// El valor real ya se aplicó al cargar la página (ver theme-init.js, que
// corre antes que este módulo para evitar el parpadeo) — esta función es
// para cuando la usuaria lo CAMBIA en caliente desde Ajustes.
const TEMA_KEY = 'nutriruta-tema';

export function getTema() {
  try { return localStorage.getItem(TEMA_KEY) || 'sistema'; } catch { return 'sistema'; }
}

export function setTema(tema) {
  try { localStorage.setItem(TEMA_KEY, tema); } catch { /* localStorage bloqueado, sigue en memoria nomás */ }
  if (tema === 'claro') document.documentElement.setAttribute('data-theme', 'light');
  else if (tema === 'oscuro') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}

// ---------- Sincronización con la nube (Supabase, protegida por RLS) ----------
let plan = { tipo: 'free', periodo: null, desde: null };
let pushTimer = null;
let cloudReady = false;

// Vigencia de cada periodo (con un pequeño margen de gracia).
const PLAN_DIAS = { mensual: 33, anual: 368 };

export function getPlan() { return plan; }
export function setPlanCache(tipo, periodo, desde = null) { plan = { tipo, periodo, desde }; }

// Fecha de vencimiento del plan actual (null si es gratuito o no hay fecha de inicio).
export function planExpiry() {
  if (plan.tipo !== 'premium' || !plan.desde || !PLAN_DIAS[plan.periodo]) return null;
  return new Date(new Date(plan.desde).getTime() + PLAN_DIAS[plan.periodo] * 86400000);
}

// Premium activo = plan premium Y dentro de su vigencia.
export function isPremium() {
  const vence = planExpiry();
  return plan.tipo === 'premium' && !!vence && Date.now() < vence.getTime();
}

// Plan premium cuya vigencia ya terminó (pago no renovado).
export function planExpired() {
  const vence = planExpiry();
  return plan.tipo === 'premium' && !!vence && Date.now() >= vence.getTime();
}

// Al iniciar sesión: baja el estado remoto (la nube manda) o sube el local si la nube está vacía.
export async function initCloud() {
  try {
    const profile = await fetchProfile();
    if (!profile) return;
    plan = { tipo: profile.plan || 'free', periodo: profile.plan_periodo || null, desde: profile.plan_desde || null };
    // El quiz ahora se responde ANTES de crear cuenta (invitada, sin
    // sesión) — lo que hay en la llave genérica en este momento puede ser
    // justo ese perfil recién armado, todavía no migrado a ninguna cuenta.
    const preAuthState = state;
    // A partir de aquí, todo lo que se lea o suba a la nube es exclusivo de
    // esta cuenta — nunca el caché que pudo dejar otra cuenta en este navegador.
    activeKey = keyFor(profile.id);
    state = loadFromKey(activeKey);
    const remote = profile.state;
    if (remote && typeof remote === 'object' && Object.keys(remote).length) {
      state = { ...structuredClone(DEFAULT_STATE), ...remote };
      localStorage.setItem(activeKey, JSON.stringify(state));
    } else if (state.onboarded) {
      await pushProfileState(state, state.user.nombre);
    } else if (preAuthState.onboarded) {
      // Cuenta recién creada (nada en la nube todavía) y el quiz ya estaba
      // respondido como invitada justo antes de este registro: es lo que
      // hay que guardar, no perderlo recargando el estado vacío de la
      // cuenta nueva.
      state = preAuthState;
      localStorage.setItem(activeKey, JSON.stringify(state));
      await pushProfileState(state, state.user.nombre);
      localStorage.removeItem(KEY); // no dejarlo en la llave genérica para la próxima invitada en este dispositivo
    }
    if (profile.nombre && !state.user.nombre) {
      state = { ...state, user: { ...state.user, nombre: profile.nombre } };
      localStorage.setItem(activeKey, JSON.stringify(state));
    }
    cloudReady = true;
  } catch (e) {
    // Sin conexión: la app sigue funcionando offline con localStorage.
    console.warn('Sync inicial no disponible:', e.message);
  }
}

function scheduleCloudPush() {
  if (!cloudReady) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushProfileState(state, state.user.nombre).catch((e) => console.warn('Sync pospuesto:', e.message));
  }, 1500);
}

// ---------- Utilidad de seguridad: escapar contenido generado por el usuario ----------
export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Fecha local (no UTC) en formato YYYY-MM-DD. Usar toISOString() directo
// aquí es un bug clásico: en Colombia (UTC-5) el día "cambiaría" a las
// 7pm hora local en vez de medianoche, reseteando agua/hábitos temprano
// y rompiendo rachas sin motivo real.
function localDateStr(date) {
  const tz = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tz).toISOString().slice(0, 10);
}

export function today() {
  return localDateStr(new Date());
}

// Rejilla de un mes completo (empieza en lunes, 6 semanas fijas) para el
// calendario de "Mis Rachas" -- cada celda trae si ese día se cumplió,
// si estaba cubierto por una Pausa de Ruta, y qué % de hábitos se
// completó ese día (de historialDiario) para poder pintar intensidad,
// no solo un punto binario como hace Fitia.
export function diasDelMes(year, month) {
  const { diasCumplidos, diasCongelados, historialDiario } = getState();
  const cumplidos = new Set(diasCumplidos);
  const congelados = new Set(diasCongelados || []);
  const porFecha = new Map(historialDiario.map((h) => [h.fecha, h]));
  const hoyISO = today();
  const primerDia = new Date(year, month, 1);
  const inicioOffset = (primerDia.getDay() + 6) % 7; // lunes=0
  const inicio = new Date(year, month, 1 - inicioOffset);
  const celdas = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const iso = localDateStr(d);
    const h = porFecha.get(iso);
    celdas.push({
      iso,
      dia: d.getDate(),
      fueraDeMes: d.getMonth() !== month,
      esHoy: iso === hoyISO,
      esFuturo: iso > hoyISO,
      cumplido: cumplidos.has(iso),
      congelado: congelados.has(iso),
      pctHabitos: h ? Math.round((h.habitosCompletados / (h.habitosTotal || 5)) * 100) : null
    });
  }
  return celdas;
}

// --- IMC (Índice de Masa Corporal): fórmula estándar de la OMS,
// peso(kg) / estatura(m)², con las mismas 4 categorías que usa la OMS.
// Es información real y de uso clínico común, no una fórmula inventada
// -- pero sí una medida limitada (no distingue masa muscular de grasa),
// por eso quien la use en la app debe mostrarla junto a esa advertencia,
// nunca como diagnóstico ni como única señal de salud. Solo se calcula
// si hay peso Y estatura reales (ninguno inventado ni asumido).
export function calcularIMC(pesoKg, estaturaCm) {
  if (!pesoKg || !estaturaCm) return null;
  const m = estaturaCm / 100;
  const valor = pesoKg / (m * m);
  let categoria;
  if (valor < 18.5) categoria = 'Bajo peso';
  else if (valor < 25) categoria = 'Normal';
  else if (valor < 30) categoria = 'Sobrepeso';
  else categoria = 'Obesidad';
  return { valor: Math.round(valor * 10) / 10, categoria };
}

// --- Meta de agua: 30–35 mL por kg de peso corporal, el rango estándar
// usado en nutrición clínica (p. ej. guías de la EFSA) — no una marca ni
// una persona. Sin sexo registrado se usa el punto medio (32.5 mL/kg);
// con sexo, se usa el extremo del mismo rango que coincide con las
// metas de ingesta total de agua de la EFSA (más alta para hombres,
// más baja para mujeres) — sigue siendo el mismo rango de siempre, solo
// mejor afinado, no una fórmula nueva inventada. En vasos de 250 mL.
// Sin peso registrado, se usa un valor general de 8 vasos.
export function getWaterGoal() {
  const kg = state.user.pesoKg;
  if (!kg || kg < 30 || kg > 200) return 8;
  const mlPorKg = state.user.sexo === 'hombre' ? 35 : state.user.sexo === 'mujer' ? 30 : 32.5;
  const vasos = Math.round((kg * mlPorKg) / 250);
  return Math.min(12, Math.max(6, vasos));
}

// --- Agua ---
export function getWater() {
  archivePreviousDay();
  if (state.agua.fecha !== today()) {
    setState({ agua: { fecha: today(), vasos: 0 } });
  }
  return { ...state.agua, meta: getWaterGoal() };
}

// Devuelve además si el hábito "agua" cambió de estado (y si se usó una
// Pausa de Ruta al recalcular la racha), para que quien llama pueda
// celebrar sin tener que reconsultar el estado por su cuenta.
export function setWater(vasos) {
  const antes = state.agua.fecha === today() ? state.agua.vasos : 0;
  setState({ agua: { fecha: today(), vasos } });
  if (vasos > antes) sumarEnergiaRuta((vasos - antes) * 1, 0);
  checkAchievements();
  // El hábito de agua ya no se marca a mano: se deriva de los vasos
  // reales que se llenaron, para que la racha refleje algo que de verdad
  // pasó (ver memoria de anti-trampa) — se marca solo al llegar a la meta.
  const escudoUsado = setHabitAuto('agua', vasos >= getWaterGoal());
  return { escudoUsado };
}

// --- Energía de Ruta: constancia y cuidado de hábitos, nunca calorías,
// peso ni "comer perfecto" — acumulado histórico simple, sin caer nunca
// por inactividad (ver memoria "solo info comprobada": no inventamos una
// barra de hambre ni urgencia artificial).
export function sumarEnergiaRuta(energia, km) {
  setState({
    energiaRuta: (state.energiaRuta || 0) + energia,
    kmRuta: (state.kmRuta || 0) + km
  });
}

// --- Peso (opcional, apagado por defecto) ---
export function logPeso(kg) {
  const valor = Number(kg);
  if (!valor || valor < 30 || valor > 300) return false;
  const pesos = [...state.pesos, { fecha: today(), kg: valor }].slice(-180);
  const user = { ...state.user, pesoKg: valor };
  setState({ pesos, user });
  return true;
}

export function ultimoPeso() {
  return state.pesos.length ? state.pesos[state.pesos.length - 1] : null;
}

// --- Memorias de SuSana: notas puntuales que la usuaria le pide recordar
// (ver assistant.js), se suman al contexto real que arma ai-assistant en
// cada respuesta -- no son solo decorativas como en Fitia. Tope de 10 para
// que el contexto que viaja al modelo no crezca sin límite.
export const MEMORIA_MAX = 10;

export function agregarMemoria(texto) {
  const limpio = String(texto || '').trim().slice(0, 200);
  if (!limpio) return false;
  const memorias = state.user.memorias || [];
  if (memorias.length >= MEMORIA_MAX) return false;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  setState({ user: { ...state.user, memorias: [...memorias, { id, texto: limpio, fecha: today() }] } });
  return true;
}

export function eliminarMemoria(id) {
  const memorias = (state.user.memorias || []).filter((m) => m.id !== id);
  setState({ user: { ...state.user, memorias } });
}

// --- Archivo diario para las gráficas de progreso ---
// Se llama de forma perezosa (idempotente) cada vez que se abre agua o
// hábitos: si el día guardado ya no es "hoy", guarda un resumen de ese
// día antes de resetear, para poder mostrar tendencias semana/mes.
function archivePreviousDay() {
  const prevFecha = state.habitos.fecha;
  if (!prevFecha || prevFecha === today()) return;
  if (state.historialDiario.some((h) => h.fecha === prevFecha)) return;

  const checks = state.habitos.checks || {};
  const entry = {
    fecha: prevFecha,
    habitosCompletados: Object.values(checks).filter(Boolean).length,
    habitosTotal: TOTAL_HABITOS_DIA,
    vasosAgua: state.agua.fecha === prevFecha ? state.agua.vasos : 0,
    metaAgua: getWaterGoal(),
    antojosTotal: state.antojos.filter((a) => a.fecha === prevFecha).length,
    antojosSuperados: state.antojos.filter((a) => a.fecha === prevFecha && a.resultado === 'alternativa').length,
    sintomasTotal: state.sintomas.filter((s) => s.fecha === prevFecha).length
  };
  const historialDiario = [...state.historialDiario, entry].slice(-90);
  setState({ historialDiario });
}

// --- Hábitos diarios ---
export function getHabits() {
  archivePreviousDay();
  if (state.habitos.fecha !== today()) {
    setState({ habitos: { fecha: today(), checks: {} } });
  }
  return state.habitos.checks;
}

export function toggleHabit(id) {
  const checks = { ...getHabits(), [id]: !getHabits()[id] };
  setState({ habitos: { fecha: today(), checks } });
  const escudoUsado = updateStreak();
  checkAchievements();
  return escudoUsado;
}

// Igual que toggleHabit, pero fija el valor en vez de invertirlo — para
// los hábitos que ya no se marcan a mano sino que se derivan de una
// acción real (agua, menú). No se expone en la UI como checkbox.
function setHabitAuto(id, value) {
  const actual = getHabits()[id];
  if (actual === value) return null; // sin cambio real, no re-evaluar racha
  const checks = { ...getHabits(), [id]: value };
  setState({ habitos: { fecha: today(), checks } });
  const escudoUsado = updateStreak();
  checkAchievements();
  return escudoUsado;
}

// --- Comidas seguidas hoy (para auto-marcar "seguí el menú") ---
function getComidasSeguidas() {
  if (state.comidasSeguidas.fecha !== today()) {
    setState({ comidasSeguidas: { fecha: today(), ids: [] } });
  }
  return state.comidasSeguidas.ids;
}

// Se llama solo al abrir una receta que de verdad es parte del menú real
// de hoy — esa decisión la toma quien llama (dashboard.js, que ya arma
// dailyMenu()), no cualquier receta del recetario cuenta: así es una
// señal real de "seguí mi menú", no de "abrí 2 recetas al azar" (ver
// memoria de anti-trampa). Con 2 comidas del día abiertas, se marca solo.
export function registrarComidaSeguida(id) {
  const ids = getComidasSeguidas();
  if (ids.includes(id)) return null;
  const nuevos = [...ids, id];
  setState({ comidasSeguidas: { fecha: today(), ids: nuevos } });
  const escudoUsado = setHabitAuto('menu', nuevos.length >= 2);
  return { escudoUsado };
}

// --- Lo que la usuaria REALMENTE comió (foto/voz/texto), estación por
// estación de Tu Ruta de Hoy — distinto de comidasSeguidas (que solo marca
// si abrió la receta sugerida). Esto es un registro real y editable, no
// una suposición: guarda lo que confirmó, no lo que el menú sugería.
function claveComida(mealId, dateStr = today()) { return `${dateStr}|${mealId}`; }

export function comidaRegistrada(mealId, dateStr = today()) {
  return state.comidasRegistradas[claveComida(mealId, dateStr)] || null;
}

export function guardarComidaRegistrada(mealId, alimentos, fuente, dateStr = today(), fotoUrl = null) {
  const clave = claveComida(mealId, dateStr);
  const registro = { alimentos, fuente, hora: new Date().toISOString() };
  if (fotoUrl) registro.fotoUrl = fotoUrl;
  setState({ comidasRegistradas: { ...state.comidasRegistradas, [clave]: registro } });
  return registro;
}

// Registros de los últimos `dias` días con foto, agrupados por fecha y
// ordenados del más reciente al más antiguo — lo que alimenta "Mi Diario".
export function diasConDiario(dias = 14) {
  const hoy = new Date(`${today()}T00:00:00`);
  const fechas = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    fechas.push(d.toISOString().slice(0, 10));
  }
  return fechas
    .map((fecha) => {
      const registros = Object.entries(state.comidasRegistradas)
        .filter(([clave, r]) => clave.startsWith(`${fecha}|`) && r.fotoUrl)
        .map(([clave, r]) => ({ mealId: clave.split('|')[1], ...r }));
      return { fecha, registros };
    })
    .filter((dia) => dia.registros.length > 0);
}

// --- Racha: un día cuenta si se marcan al menos 3 hábitos ---
export function dayCompleted() {
  const checks = getHabits();
  return Object.values(checks).filter(Boolean).length >= 3;
}

// Valida que sea una reflexión real escrita por la persona, no relleno
// para pasar el mínimo: suficientes letras (no solo símbolos/números),
// variedad de caracteres (no "aaaaaaaa..." ni "jajajaja..."), al menos un
// espacio (una reflexión real casi siempre tiene más de una palabra). El
// mínimo de largo es ajustable: el Plan de 7 días pide algo más elaborado
// (40) que el check-in diario de hábitos (12, solo para frenar marcar los
// 3 de un tirón sin haberlos hecho, sin volverse una tarea pesada).
export function esTextoReal(texto, minLen = 40) {
  const t = (texto || '').trim();
  if (t.length < minLen) return false;
  const letras = t.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, '');
  // Mismas proporciones que ya validó el Plan de 7 días (25 letras y 8
  // únicas sobre un mínimo de 40) escaladas al mínimo que se pida.
  if (letras.length < Math.round(minLen * 0.625)) return false;
  const unicas = new Set(letras.toLowerCase()).size;
  if (unicas < Math.max(5, Math.round(minLen * 0.2))) return false;
  if (!/\s/.test(t)) return false;
  return true;
}

// --- Pausas de Ruta (antes "escudos"): acompañan cuando se falla
// exactamente un día. Se ganan 1 cada 7 Días en Ruta. Tope 2 en el plan
// gratuito, 4 en Premium (mismo espíritu que el "streak freeze" de
// Duolingo — evita que el sistema todo-o-nada sea la razón de abandonar,
// que es la causa #1 documentada de dejar un hábito nuevo).
export function maxEscudos() {
  return isPremium() ? 4 : 2;
}

// --- Gemas: moneda simple, sin economía compleja. Se ganan solo en los
// mismos hitos que ya celebran la app (día completo, día del plan de 7
// días, semana de la misión) — no hay una fuente nueva de "grindeo". Se
// gastan en un único destino con sentido real: comprar un escudo extra
// cuando ya se llegó al tope de los que se ganan gratis.
export const GEMAS_POR_DIA = 5;
export const COSTO_ESCUDO_GEMAS = 60;

export function comprarEscudo() {
  if (state.escudos >= maxEscudos()) return false;
  if (state.gemas < COSTO_ESCUDO_GEMAS) return false;
  setState({ escudos: state.escudos + 1, gemas: state.gemas - COSTO_ESCUDO_GEMAS });
  return true;
}

// Para hitos que no pasan por updateStreak() (día del Plan de 7 días,
// semana de la Misión) — mismos hitos que ya celebran confeti, ninguno nuevo.
export function otorgarGemas(n) {
  setState({ gemas: (state.gemas || 0) + n });
}

// Recetas marcadas con la estrella en el Recetario (ver planner.js).
export function toggleFavorita(recipeId) {
  const favoritas = state.favoritas || [];
  const nuevas = favoritas.includes(recipeId) ? favoritas.filter((id) => id !== recipeId) : [...favoritas, recipeId];
  setState({ favoritas: nuevas });
}

function updateStreak() {
  const t = today();
  if (!dayCompleted()) return;
  if (state.diasCumplidos.includes(t)) return;

  const dias = [...state.diasCumplidos, t];
  const gap = state.racha.ultimoDia ? diffDias(state.racha.ultimoDia, t) : null;
  let escudos = state.escudos;
  let actual;
  let escudoUsado = false;
  let diasCongelados = state.diasCongelados || [];

  if (gap === 1 || gap === null) {
    actual = state.racha.actual + 1;
  } else if (gap === 2 && escudos > 0) {
    escudos -= 1;
    escudoUsado = true;
    actual = state.racha.actual + 1;
    // El día saltado queda "congelado" (como el streak freeze de
    // Duolingo), no roto: se marca con la llamita de hielo en el
    // calendario en vez de quedar en blanco.
    const diaSaltado = new Date(new Date(state.racha.ultimoDia).getTime() + 86400000).toISOString().slice(0, 10);
    diasCongelados = [...diasCongelados, diaSaltado].slice(-90);
  } else {
    actual = 1;
  }

  if (actual > 0 && actual % 7 === 0 && escudos < maxEscudos()) escudos += 1;

  const mejor = Math.max(actual, state.racha.mejor);
  const gemas = (state.gemas || 0) + GEMAS_POR_DIA;
  setState({ diasCumplidos: dias, racha: { actual, mejor, ultimoDia: t }, escudos, gemas, diasCongelados });
  return escudoUsado;
}

// --- Antojos (SOS) ---
export function logCraving(tipo, resultado) {
  const ahora = new Date();
  const antojos = [...state.antojos, {
    fecha: today(),
    hora: `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`,
    tipo, resultado
  }];
  setState({ antojos });
  if (resultado === 'alternativa') sumarEnergiaRuta(2, 1); // "Completar SOS Antojo"
  checkAchievements();
}

// Detecta la franja horaria con más antojos registrados (mini "motor IA" local).
export function cravingPattern() {
  if (state.antojos.length < 3) return null;
  const franjas = {};
  for (const a of state.antojos) {
    const h = parseInt(a.hora.slice(0, 2), 10);
    const franja = h < 12 ? 'mañana' : h < 15 ? 'mediodía' : h < 19 ? 'tarde' : 'noche';
    franjas[franja] = (franjas[franja] || 0) + 1;
  }
  const top = Object.entries(franjas).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 2 ? top[0] : null;
}

// --- Diario de síntomas (detector de disparadores unificado) ---
export function logSintoma(tipo, disparador) {
  const ahora = new Date();
  const sintomas = [...state.sintomas, {
    fecha: today(),
    hora: `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`,
    tipo, disparador: (disparador || '').trim().toLowerCase().slice(0, 60)
  }];
  setState({ sintomas });
  checkAchievements();
}

// Busca un disparador repetido (≥2 veces) o, si no hay, la franja horaria más frecuente.
export function sintomaPattern() {
  if (state.sintomas.length < 3) return null;
  const disparadores = {};
  for (const s of state.sintomas) {
    if (!s.disparador) continue;
    disparadores[s.disparador] = (disparadores[s.disparador] || 0) + 1;
  }
  const topDisparador = Object.entries(disparadores).sort((a, b) => b[1] - a[1])[0];
  if (topDisparador && topDisparador[1] >= 2) return { tipo: 'disparador', valor: topDisparador[0] };

  const franjas = {};
  for (const s of state.sintomas) {
    const h = parseInt(s.hora.slice(0, 2), 10);
    const franja = h < 12 ? 'mañana' : h < 15 ? 'mediodía' : h < 19 ? 'tarde' : 'noche';
    franjas[franja] = (franjas[franja] || 0) + 1;
  }
  const topFranja = Object.entries(franjas).sort((a, b) => b[1] - a[1])[0];
  return topFranja && topFranja[1] >= 2 ? { tipo: 'franja', valor: topFranja[0] } : null;
}

// --- Check-ins de seguimiento (breves, nunca obligatorios) ---
// Aparecen cada ~3 días de uso; si se posponen, vuelven a aparecer al
// día siguiente. Nunca bloquean el uso de la app.
function diffDias(fechaA, fechaB) {
  return Math.round((new Date(fechaB) - new Date(fechaA)) / 86400000);
}

export function shouldShowCheckin() {
  if (!state.onboarded || state.diasCumplidos.length < 1) return false;
  const t = today();
  const last = state.checkins.length ? state.checkins[state.checkins.length - 1].fecha : null;
  const diasDesdeUltimo = last ? diffDias(last, t) : 999;
  const diasDesdePospuesto = state.checkinPospuesto ? diffDias(state.checkinPospuesto, t) : 999;
  return diasDesdeUltimo >= 3 && diasDesdePospuesto >= 1;
}

export function postponeCheckin() {
  setState({ checkinPospuesto: today() });
}

export function logCheckin({ animo, antojosImpulsos, menuExperiencia, notas }) {
  const ahora = new Date();
  const entry = {
    fecha: today(),
    hora: `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`,
    animo, antojosImpulsos, menuExperiencia,
    notas: (notas || '').trim().slice(0, 300),
    compartir: null // null = aún no se invitó a compartir; true/false = respuesta
  };
  const checkins = [...state.checkins, entry];
  setState({ checkins, checkinPospuesto: null });
  return checkins.length - 1;
}

// Guarda la respuesta a "¿nos autorizas a compartir esto como testimonio?".
export function responderInvitacionTestimonio(index, compartir) {
  const checkins = state.checkins.map((c, i) => (i === index ? { ...c, compartir } : c));
  setState({ checkins });
}

// --- Reflexiones del Plan de 7 días (opcionales, día a día) ---
export function guardarReflexionDia(diaN, texto) {
  const { emergencia } = state;
  if (!emergencia) return;
  const reflexiones = { ...(emergencia.reflexiones || {}), [diaN]: (texto || '').trim().slice(0, 500) };
  setState({ emergencia: { ...emergencia, reflexiones } });
}

// Reflexión breve al completar el día (3+ hábitos) — no es una tarea
// extra, es lo que impide marcar los 3 de un tirón sin haberlos hecho de
// verdad: pedir una frase real (esTextoReal) es más fácil de cumplir
// honestamente que de inventar en frío.
export function guardarReflexionHabitos(texto) {
  const fecha = today();
  const reflexionesHabitos = { ...(state.reflexionesHabitos || {}), [fecha]: (texto || '').trim().slice(0, 300) };
  setState({ reflexionesHabitos });
}

// La invitación a compartir las reflexiones como testimonio se pregunta UNA
// sola vez, al completar el día 7 — no cada día (fatiga de permisos) — y
// queda marcada aunque la respuesta sea "no", para no volver a preguntar.
export function responderInvitacionTestimonioPlan(compartir) {
  const { emergencia } = state;
  if (!emergencia) return;
  setState({ emergencia: { ...emergencia, compartirReflexiones: compartir, testimonioPlanPreguntado: true } });
}

// --- "Tu paso de hoy": obstáculo + micro-acción, elegido según el patrón de
// antojos ya detectado (misma franja horaria que usa cravingPattern()). Sin
// patrón suficiente todavía, usa el pozo 'general'. La elección es
// determinista por día (todas las usuarias con el mismo contexto ven el
// mismo paso ese día, y cambia al día siguiente) — no requiere IA ni red.
function hashDia(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function pasoDeHoy() {
  const contexto = cravingPattern() || 'general';
  const pool = DAILY_STEPS.filter((s) => s.contexto === contexto);
  const usado = pool.length ? pool : DAILY_STEPS.filter((s) => s.contexto === 'general');
  const idx = hashDia(today() + contexto) % usado.length;
  return usado[idx];
}

export function pasoHechoHoy() {
  return state.pasoHechos.includes(today());
}

// Racha de días consecutivos marcando "Tu paso de hoy" (independiente de la
// racha de hábitos). Se rompe si el último día registrado no es hoy ni ayer.
export function pasoRacha() {
  const dias = [...new Set(state.pasoHechos)].sort();
  if (!dias.length) return 0;
  let racha = 1;
  for (let i = dias.length - 1; i > 0; i--) {
    if (diffDias(dias[i - 1], dias[i]) === 1) racha++; else break;
  }
  const ultimo = dias[dias.length - 1];
  const t = today();
  const ayer = localDateStr(new Date(Date.now() - 86400000));
  return (ultimo === t || ultimo === ayer) ? racha : 0;
}

export function marcarPasoHecho() {
  if (pasoHechoHoy()) return pasoRacha();
  const pasoHechos = [...state.pasoHechos, today()].slice(-180);
  setState({ pasoHechos });
  sumarEnergiaRuta(2, 1); // "Completar microacción" en la tabla de Energía de Ruta
  return pasoRacha();
}

// --- Sana proactiva: elige una línea de apertura según el contexto real
// (nunca genérica al azar si hay una señal más específica disponible).
// Determinista por día, igual que pasoDeHoy() — no llama a la IA, así que
// no consume cuota ni cuesta nada mostrarla.
function elegirDeLista(lista) {
  if (!lista.length) return null;
  return lista[hashDia(today() + lista.length) % lista.length];
}

export function sanaApertura() {
  const ultimo = state.checkins.length ? state.checkins[state.checkins.length - 1] : null;
  if (ultimo && ultimo.animo === 'dificil' && diffDias(ultimo.fecha, today()) <= 1) {
    return elegirDeLista(SANA_OPENERS.animo_dificil);
  }
  const patron = cravingPattern();
  if (patron) {
    const linea = elegirDeLista(SANA_OPENERS.patron_antojo);
    return linea.replace('{franja}', patron);
  }
  if (state.racha.actual === 0 && state.diasCumplidos.length > 0) {
    return elegirDeLista(SANA_OPENERS.ruta_pausada);
  }
  return elegirDeLista(SANA_OPENERS.general);
}

// --- Logros ---
export const ACHIEVEMENTS = [
  { id: 'primer_dia', emoji: '🌱', nombre: 'Primer día', desc: 'Completaste tu primer día de hábitos.' },
  { id: 'racha_3', emoji: '🔥', nombre: '3 días seguidos', desc: 'Racha de 3 días cumpliendo hábitos.' },
  { id: 'racha_7', emoji: '⭐', nombre: 'Semana completa', desc: '7 días seguidos de hábitos cumplidos.' },
  { id: 'racha_30', emoji: '🏆', nombre: 'Reto 30 días', desc: '30 días seguidos. Cambiaste tu historia.' },
  { id: 'hidratada', emoji: '💧', nombre: 'Bien hidratada', desc: 'Alcanzaste tu meta de agua del día.' },
  { id: 'sos_superado', emoji: '💚', nombre: 'Antojo superado', desc: 'Usaste una alternativa saludable ante un antojo.' },
  { id: 'sos_5', emoji: '🛡️', nombre: '5 antojos vencidos', desc: 'Cinco veces elegiste la alternativa saludable.' },
  { id: 'detective', emoji: '🔍', nombre: 'Detective de síntomas', desc: 'Registraste 3 síntomas: ya podemos buscar tus patrones.' },
  { id: 'plan7_completo', emoji: '🎉', nombre: 'Primer paso dado', desc: 'Completaste el plan de 7 días. Empezaste sin esperar.' }
];

function unlock(id) {
  if (!state.logros.includes(id)) {
    setState({ logros: [...state.logros, id] });
    return true;
  }
  return false;
}

export function checkAchievements() {
  const nuevos = [];
  if (state.diasCumplidos.length >= 1 && unlock('primer_dia')) nuevos.push('primer_dia');
  if (state.racha.actual >= 3 && unlock('racha_3')) nuevos.push('racha_3');
  if (state.racha.actual >= 7 && unlock('racha_7')) nuevos.push('racha_7');
  if (state.racha.actual >= 30 && unlock('racha_30')) nuevos.push('racha_30');
  if (state.agua.fecha === today() && state.agua.vasos >= getWaterGoal() && unlock('hidratada')) nuevos.push('hidratada');
  const superados = state.antojos.filter((a) => a.resultado === 'alternativa').length;
  if (superados >= 1 && unlock('sos_superado')) nuevos.push('sos_superado');
  if (superados >= 5 && unlock('sos_5')) nuevos.push('sos_5');
  if (state.sintomas.length >= 3 && unlock('detective')) nuevos.push('detective');
  if ((state.emergencia?.completados || []).length >= 7 && unlock('plan7_completo')) nuevos.push('plan7_completo');
  return nuevos;
}
