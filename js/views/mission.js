// Misión 12 semanas (función premium).
// El contenido de las semanas se pide al servidor, que solo entrega lo que el
// plan del usuario permite (semana 1 gratis; 2–12 con Premium vigente).
import { MISSION } from '../data/mission.js';
import { fetchMissionWeeks, fetchMissionIndex } from '../supabase-client.js';
import { getState, setState, isPremium, planExpired, today } from '../store.js';
import { header, navigate, toast, openModal } from '../app.js';
import { renderPathMap } from '../pathMap.js';
import { celebrateMilestone } from '../streakAnim.js';
import { playCelebrateSound } from '../sound.js';

const WEEKS_CACHE_KEY = 'nutriruta-mission-weeks';
const INDEX_CACHE_KEY = 'nutriruta-mission-index';

// Últimas semanas entregadas por el servidor, para poder leerlas sin conexión.
async function loadWeeks() {
  try {
    const weeks = await fetchMissionWeeks();
    if (weeks.length) localStorage.setItem(WEEKS_CACHE_KEY, JSON.stringify(weeks));
    return weeks;
  } catch {
    try { return JSON.parse(localStorage.getItem(WEEKS_CACHE_KEY) || '[]'); } catch { return []; }
  }
}

// Índice de las 12 semanas (solo títulos): visible también sin Premium,
// para que el mapa completo se vea igual y lo bloqueado invite a desbloquear.
async function loadIndex() {
  try {
    const idx = await fetchMissionIndex();
    if (idx.length) localStorage.setItem(INDEX_CACHE_KEY, JSON.stringify(idx));
    return idx;
  } catch {
    try { return JSON.parse(localStorage.getItem(INDEX_CACHE_KEY) || '[]'); } catch { return []; }
  }
}

export function renderMission(container) {
  header(container);
  const { mision } = getState();
  const premium = isPremium();

  const hero = document.createElement('div');
  hero.className = 'mission-hero';
  hero.innerHTML = `
    <h2>🧭 ${MISSION.nombre}</h2>
    <p>${MISSION.descripcion}</p>`;
  container.appendChild(hero);

  // Sin Premium (nunca lo tuvo, o venció): el mapa completo se ve igual que
  // para Premium — la Semana 1 es gratis y abre su contenido real; las demás
  // aparecen bloqueadas y llevan a Planes. Así lo bloqueado se antoja, en
  // vez de esconderse detrás de un botón.
  if (!premium) {
    const note = document.createElement('div');
    note.className = 'card';
    const completadasFree = (mision?.completadas || []).length;
    note.innerHTML = planExpired()
      ? `<p class="small">⏸️ <strong>Tu plan Premium venció.</strong> Tu progreso (${completadasFree}/12 semanas) está guardado y te espera. Renueva para continuar donde ibas.</p>
         <button class="btn accent full mt">Renovar Premium</button>`
      : `<p class="small">✨ La <strong>Semana 1 es gratis</strong> — pruébala hoy mismo. Las demás se desbloquean con el <strong>plan Premium</strong>.</p>
         <button class="btn accent full mt">Desbloquear las 12 semanas</button>`;
    note.querySelector('.btn').addEventListener('click', () => navigate('plans'));
    container.appendChild(note);

    const list = document.createElement('div');
    list.className = 'card';
    list.innerHTML = '<p class="muted small center">Cargando el mapa de tu misión…</p>';
    container.appendChild(list);

    loadIndex().then((idx) => {
      list.innerHTML = '';
      if (!idx.length) {
        list.innerHTML = '<p class="center">No se pudo cargar el contenido. Revisa tu conexión e inténtalo de nuevo.</p>';
        return;
      }
      const completadas = mision?.completadas || [];
      const items = idx.map((w) => ({
        icon: w.emoji, title: `Semana ${w.n}`, subtitle: w.titulo,
        done: completadas.includes(w.n),
        now: w.gratis && !completadas.includes(w.n),
        locked: !w.gratis,
        nowLabel: 'Gratis',
        onClick: async () => {
          if (!w.gratis) {
            toast('✨ Esta semana es parte del plan Premium.');
            navigate('plans');
            return;
          }
          const weeks = await loadWeeks();
          const full = weeks.find((x) => x.n === w.n);
          if (full) openWeek(full, false);
          else toast('No se pudo cargar la semana. Revisa tu conexión.');
        }
      }));
      renderTramos(list, items);
    });
    return;
  }

  // Sin misión iniciada (con Premium)
  if (!mision || !mision.inicio) {
    const start = document.createElement('div');
    start.className = 'card center';
    start.innerHTML = `
      <p>Doce semanas, un cambio por semana. Cada semana tiene un objetivo claro, acciones concretas y una reflexión.</p>
      <button class="btn accent full mt">🚀 Empezar mi misión</button>`;
    start.querySelector('.btn').addEventListener('click', () => {
      setState({ mision: { inicio: today(), completadas: [] } });
      toast('¡Misión iniciada! Un cambio a la vez 🌱');
      renderMission(clear(container));
    });
    container.appendChild(start);
    return;
  }

  // Misión en curso
  const inicio = new Date(mision.inicio + 'T00:00:00');
  const semanaActual = Math.min(12, Math.floor((Date.now() - inicio.getTime()) / (7 * 86400000)) + 1);
  const completadas = mision.completadas || [];

  const prog = document.createElement('div');
  prog.className = 'card';
  prog.innerHTML = `
    <div class="spread"><h2>Semana ${semanaActual} de 12</h2><span class="tag info">${completadas.length}/12 completadas</span></div>
    <div class="quiz-progress mt"><div style="width:${Math.round((completadas.length / 12) * 100)}%"></div></div>`;
  container.appendChild(prog);

  const list = document.createElement('div');
  list.className = 'card';
  list.innerHTML = '<p class="muted small center">Cargando tu misión…</p>';
  container.appendChild(list);

  loadWeeks().then((weeks) => {
    list.innerHTML = '';
    if (!weeks.length) {
      list.innerHTML = '<p class="center">No se pudo cargar el contenido. Revisa tu conexión e inténtalo de nuevo.</p>';
      return;
    }
    const items = weeks.map((w) => {
      const done = completadas.includes(w.n);
      const isCurrent = w.n === semanaActual;
      const locked = w.n > semanaActual;
      return {
        icon: w.emoji, title: `Semana ${w.n}`, subtitle: w.titulo,
        done, now: isCurrent, locked, nowLabel: 'Actual',
        onClick: () => {
          if (locked) { mostrarSemanaBloqueada(w, inicio); return; }
          openWeek(w, true, done, () => renderMission(clear(container)));
        }
      };
    });
    renderTramos(list, items);

    if (completadas.length === 12) {
      const fin = document.createElement('div');
      fin.className = 'card center';
      fin.innerHTML = '<div style="font-size:3.4rem">🏆</div><h2 class="mt">¡Misión cumplida!</h2><p class="mt">Doce semanas de cambios reales. Agenda tus exámenes de control y celebra tu progreso.</p>';
      container.appendChild(fin);
    }
  });
}

// Agrupa las semanas en tramos de 3 (como paradas de una expedición), cada
// uno con su propio camino y un banner de checkpoint — reordena visualmente
// las mismas 12 semanas reales, no inventa contenido nuevo.
const TRAMO_SIZE = 3;
function renderTramos(container, items) {
  container.innerHTML = '';
  for (let i = 0; i < items.length; i += TRAMO_SIZE) {
    const grupo = items.slice(i, i + TRAMO_SIZE);
    const tramoN = i / TRAMO_SIZE + 1;
    const desde = i + 1, hasta = Math.min(i + TRAMO_SIZE, items.length);
    const grupoCompleto = grupo.every((it) => it.done);
    const banner = document.createElement('div');
    banner.className = 'tramo-banner' + (grupoCompleto ? ' done' : '');
    banner.innerHTML = `<span class="tramo-badge">${grupoCompleto ? '🏅' : tramoN}</span><span class="tramo-label">Tramo ${tramoN} · Semanas ${desde}-${hasta}</span>`;
    container.appendChild(banner);
    const sub = document.createElement('div');
    container.appendChild(sub);
    renderPathMap(sub, grupo);
  }
}

// Mensaje cálido con el número real de días que faltan (no un genérico
// "más adelante") cuando se toca una semana que aún no toca por calendario.
function mostrarSemanaBloqueada(week, inicio) {
  const msDesbloqueo = inicio.getTime() + (week.n - 1) * 7 * 86400000;
  const diasFaltan = Math.max(1, Math.ceil((msDesbloqueo - Date.now()) / 86400000));
  celebrateMilestone(`Semana ${week.n} llega en ${diasFaltan} día${diasFaltan === 1 ? '' : 's'}`, 'Un cambio a la vez — disfruta la semana actual primero 🌱');
}

function openWeek(week, canComplete, done = false, onChange) {
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2.4rem">${week.emoji}</div>
      <h2>Semana ${week.n}: ${week.titulo}</h2>
      <p class="mt"><strong>Objetivo:</strong> ${week.objetivo}</p>
      <h3 class="mt">Acciones de la semana</h3>
      <ul class="steps">${(week.acciones || []).map((a) => `<li>${a}</li>`).join('')}</ul>
      <h3 class="mt">Para reflexionar</h3>
      <p>${week.reflexion}</p>`);
    if (canComplete) {
      const btn = document.createElement('button');
      btn.className = done ? 'btn ghost full mt' : 'btn full mt';
      btn.textContent = done ? '↩️ Desmarcar semana' : '✅ Marcar semana como completada';
      btn.addEventListener('click', () => {
        const { mision } = getState();
        const completadas = new Set(mision.completadas || []);
        const completando = !done;
        done ? completadas.delete(week.n) : completadas.add(week.n);
        setState({ mision: { ...mision, completadas: [...completadas] } });
        close();
        if (completando) {
          playCelebrateSound();
          celebrateMilestone(`¡Semana ${week.n} completada!`, week.titulo);
        }
        if (onChange) onChange();
      });
      modal.appendChild(btn);
    }
  });
}

function clear(container) { container.innerHTML = ''; return container; }
