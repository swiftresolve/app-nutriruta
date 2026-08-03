// Checklist "Primeros pasos": solo aparece a cuentas nuevas (sin ningún
// día completado todavía). Las 4 acciones se calculan leyendo estado que
// ya existe en la app — no requiere tocar ninguna otra función para saber
// qué se completó. Minimizar/cerrar queda guardado en el estado, así que
// el progreso nunca se pierde.
import { getState, setState, pasoHechoHoy, esc } from '../store.js';

function acciones(state) {
  const checks = state.habitos?.checks || {};
  const habitoHecho = Object.values(checks).some(Boolean);
  const aguaHecha = (state.agua?.vasos || 0) >= 1;
  const pasoHecho = pasoHechoHoy();
  const planIniciado = !!state.emergencia?.inicio;
  return [
    { id: 'habito', emoji: '✅', label: 'Marca tu primer hábito de hoy', done: habitoHecho },
    { id: 'paso', emoji: '🌿', label: 'Da tu "Paso de hoy" como hecho', done: pasoHecho },
    { id: 'agua', emoji: '💧', label: 'Registra tu primer vaso de agua', done: aguaHecha },
    { id: 'plan7', emoji: '🏁', label: 'Empieza tu Plan de 7 días', done: planIniciado }
  ];
}

// Solo cuentas nuevas: ni un día completado todavía y que no lo hayan cerrado.
export function primerosPasosVisible() {
  const state = getState();
  if (!state.onboarded) return false;
  if ((state.diasCumplidos || []).length > 0) return false;
  if (state.primerosPasos?.cerrado) return false;
  return true;
}

function guardar(patch) {
  setState({ primerosPasos: { ...(getState().primerosPasos || {}), ...patch } });
}

export function renderPrimerosPasos(container, onChange) {
  const state = getState();
  const items = acciones(state);
  const completados = items.filter((i) => i.done).length;
  const minimizado = !!state.primerosPasos?.minimizado;

  const card = document.createElement('div');
  card.className = 'card';
  card.style.borderLeft = '4px solid var(--accent)';

  if (minimizado) {
    card.innerHTML = `
      <div class="spread">
        <span class="small" style="font-weight:700">🚀 Primeros pasos — ${completados}/${items.length}</span>
        <div class="row" style="gap:2px">
          <button class="icon-btn" id="pp-expandir" aria-label="Expandir">▾</button>
          <button class="icon-btn" id="pp-cerrar" aria-label="Cerrar">✕</button>
        </div>
      </div>`;
  } else {
    card.innerHTML = `
      <div class="spread">
        <h3>🚀 Primeros pasos</h3>
        <div class="row" style="gap:2px">
          <button class="icon-btn" id="pp-minimizar" aria-label="Minimizar">─</button>
          <button class="icon-btn" id="pp-cerrar" aria-label="Cerrar">✕</button>
        </div>
      </div>
      <p class="small mt">Completa esto para sacarle el máximo provecho a NutriRuta desde el día uno.</p>
      <div class="quiz-progress mt" style="margin-bottom:6px"><div style="width:${Math.round((completados / items.length) * 100)}%"></div></div>
      ${items.map((i) => `
        <div class="habit${i.done ? ' done' : ''}">
          <span style="font-size:1.2rem">${i.done ? '✅' : i.emoji}</span>
          <label>${esc(i.label)}</label>
        </div>`).join('')}`;
  }
  container.appendChild(card);

  const cerrarBtn = card.querySelector('#pp-cerrar');
  if (cerrarBtn) cerrarBtn.addEventListener('click', () => { guardar({ cerrado: true }); onChange(); });

  const minBtn = card.querySelector('#pp-minimizar');
  if (minBtn) minBtn.addEventListener('click', () => { guardar({ minimizado: true }); onChange(); });

  const expBtn = card.querySelector('#pp-expandir');
  if (expBtn) expBtn.addEventListener('click', () => { guardar({ minimizado: false }); onChange(); });
}
