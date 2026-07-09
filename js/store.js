// Estado persistente en localStorage + sincronización con Supabase.
import { fetchProfile, pushProfileState } from './supabase-client.js';

const KEY = 'nutriruta-state-v1';

const DEFAULT_STATE = {
  onboarded: false,
  user: {
    nombre: '',
    objetivos: [],
    perfiles: [],
    exclusiones: [],
    habitosDificiles: [],
    actividad: 'medio',
    azucarFreq: 'a_veces',
    alcoholFreq: 'nunca',
    colonPredominante: null
  },
  agua: { fecha: '', vasos: 0, meta: 8 },
  habitos: { fecha: '', checks: {} },
  racha: { actual: 0, mejor: 0, ultimoDia: '' },
  diasCumplidos: [],           // fechas ISO en que se completó el día
  antojos: [],                 // { fecha, hora, tipo, resultado }
  sintomas: [],                 // { fecha, hora, tipo, disparador }
  logros: [],                  // ids de logros desbloqueados
  menuOverrides: {},           // { 'fecha|comida': n } desplazamiento al cambiar receta
  compras: {}                  // { itemId: true } marcados en lista de compras
};

let state = load();

function load() {
  try {
    // Migrar el estado guardado bajo nombres anteriores de la app.
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      for (const oldKey of ['savibra-state-v1', 'nutralma-state-v1']) {
        const old = localStorage.getItem(oldKey);
        if (old) { raw = old; localStorage.setItem(KEY, old); localStorage.removeItem(oldKey); break; }
      }
    }
    if (!raw) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export function getState() { return state; }

export function setState(patch) {
  state = { ...state, ...patch };
  localStorage.setItem(KEY, JSON.stringify(state));
  scheduleCloudPush();
}

export function resetState() {
  state = structuredClone(DEFAULT_STATE);
  localStorage.removeItem(KEY);
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
    const remote = profile.state;
    if (remote && typeof remote === 'object' && Object.keys(remote).length) {
      state = { ...structuredClone(DEFAULT_STATE), ...remote };
      localStorage.setItem(KEY, JSON.stringify(state));
    } else if (state.onboarded) {
      await pushProfileState(state, state.user.nombre);
    }
    if (profile.nombre && !state.user.nombre) {
      state = { ...state, user: { ...state.user, nombre: profile.nombre } };
      localStorage.setItem(KEY, JSON.stringify(state));
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

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// --- Agua ---
export function getWater() {
  if (state.agua.fecha !== today()) {
    setState({ agua: { ...state.agua, fecha: today(), vasos: 0 } });
  }
  return state.agua;
}

export function setWater(vasos) {
  setState({ agua: { ...state.agua, fecha: today(), vasos } });
  checkAchievements();
}

// --- Hábitos diarios ---
export function getHabits() {
  if (state.habitos.fecha !== today()) {
    setState({ habitos: { fecha: today(), checks: {} } });
  }
  return state.habitos.checks;
}

export function toggleHabit(id) {
  const checks = { ...getHabits(), [id]: !getHabits()[id] };
  setState({ habitos: { fecha: today(), checks } });
  updateStreak();
  checkAchievements();
}

// --- Racha: un día cuenta si se marcan al menos 3 hábitos ---
export function dayCompleted() {
  const checks = getHabits();
  return Object.values(checks).filter(Boolean).length >= 3;
}

function updateStreak() {
  const t = today();
  if (!dayCompleted()) return;
  if (state.diasCumplidos.includes(t)) return;

  const dias = [...state.diasCumplidos, t];
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const actual = state.racha.ultimoDia === ayer ? state.racha.actual + 1 : 1;
  const mejor = Math.max(actual, state.racha.mejor);
  setState({ diasCumplidos: dias, racha: { actual, mejor, ultimoDia: t } });
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
  if (state.agua.fecha === today() && state.agua.vasos >= state.agua.meta && unlock('hidratada')) nuevos.push('hidratada');
  const superados = state.antojos.filter((a) => a.resultado === 'alternativa').length;
  if (superados >= 1 && unlock('sos_superado')) nuevos.push('sos_superado');
  if (superados >= 5 && unlock('sos_5')) nuevos.push('sos_5');
  if (state.sintomas.length >= 3 && unlock('detective')) nuevos.push('detective');
  if ((state.emergencia?.completados || []).length >= 7 && unlock('plan7_completo')) nuevos.push('plan7_completo');
  return nuevos;
}
