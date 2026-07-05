// Estado persistente en localStorage.
const KEY = 'nutralma-state-v1';

const DEFAULT_STATE = {
  onboarded: false,
  user: {
    nombre: '',
    objetivos: [],
    perfiles: [],
    exclusiones: [],
    habitosDificiles: [],
    actividad: 'medio',
    azucarFreq: 'a_veces'
  },
  agua: { fecha: '', vasos: 0, meta: 8 },
  habitos: { fecha: '', checks: {} },
  racha: { actual: 0, mejor: 0, ultimoDia: '' },
  diasCumplidos: [],           // fechas ISO en que se completó el día
  antojos: [],                 // { fecha, hora, tipo, resultado }
  logros: [],                  // ids de logros desbloqueados
  menuOverrides: {},           // { 'fecha|comida': n } desplazamiento al cambiar receta
  compras: {}                  // { itemId: true } marcados en lista de compras
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
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
}

export function resetState() {
  state = structuredClone(DEFAULT_STATE);
  localStorage.removeItem(KEY);
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

// --- Logros ---
export const ACHIEVEMENTS = [
  { id: 'primer_dia', emoji: '🌱', nombre: 'Primer día', desc: 'Completaste tu primer día de hábitos.' },
  { id: 'racha_3', emoji: '🔥', nombre: '3 días seguidos', desc: 'Racha de 3 días cumpliendo hábitos.' },
  { id: 'racha_7', emoji: '⭐', nombre: 'Semana completa', desc: '7 días seguidos de hábitos cumplidos.' },
  { id: 'racha_30', emoji: '🏆', nombre: 'Reto 30 días', desc: '30 días seguidos. Cambiaste tu historia.' },
  { id: 'hidratada', emoji: '💧', nombre: 'Bien hidratada', desc: 'Alcanzaste tu meta de agua del día.' },
  { id: 'sos_superado', emoji: '💚', nombre: 'Antojo superado', desc: 'Usaste una alternativa saludable ante un antojo.' },
  { id: 'sos_5', emoji: '🛡️', nombre: '5 antojos vencidos', desc: 'Cinco veces elegiste la alternativa saludable.' }
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
  return nuevos;
}
