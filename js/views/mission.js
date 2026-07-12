// Misión 12 semanas (función premium).
// El contenido de las semanas se pide al servidor, que solo entrega lo que el
// plan del usuario permite (semana 1 gratis; 2–12 con Premium vigente).
import { MISSION } from '../data/mission.js';
import { fetchMissionWeeks } from '../supabase-client.js';
import { getState, setState, isPremium, planExpired, today } from '../store.js';
import { header, navigate, toast, openModal } from '../app.js';
import { renderPathMap } from '../pathMap.js';

const WEEKS_CACHE_KEY = 'nutriruta-mission-weeks';

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

export function renderMission(container) {
  header(container);
  const { mision } = getState();
  const premium = isPremium();

  const hero = document.createElement('div');
  hero.className = 'sos-hero';
  hero.innerHTML = `
    <h2>🎯 ${MISSION.nombre}</h2>
    <p>${MISSION.descripcion}</p>`;
  container.appendChild(hero);

  // Sin misión iniciada
  if (!mision || !mision.inicio) {
    const start = document.createElement('div');
    start.className = 'card center';
    start.innerHTML = `
      <p>Doce semanas, un cambio por semana. Cada semana tiene un objetivo claro, acciones concretas y una reflexión.</p>
      ${premium
        ? '<button class="btn accent full mt">🚀 Empezar mi misión</button>'
        : `<div class="legal-note" style="text-align:left">✨ La Misión 12 semanas es parte del <strong>plan Premium</strong>. Puedes ver la Semana 1 gratis como prueba.</div>
           <button class="btn accent full mt" id="m-plans">Ver planes Premium</button>
           <button class="btn ghost full mt" id="m-preview">Ver Semana 1 gratis</button>`}
    `;
    if (premium) {
      start.querySelector('.btn').addEventListener('click', () => {
        setState({ mision: { inicio: today(), completadas: [] } });
        toast('¡Misión iniciada! Un cambio a la vez 🌱');
        renderMission(clear(container));
      });
    } else {
      start.querySelector('#m-plans').addEventListener('click', () => navigate('plans'));
      start.querySelector('#m-preview').addEventListener('click', async () => {
        const weeks = await loadWeeks();
        const w1 = weeks.find((w) => w.n === 1);
        if (w1) openWeek(w1, false);
        else toast('No se pudo cargar la semana de prueba. Revisa tu conexión.');
      });
    }
    container.appendChild(start);
    return;
  }

  // Misión iniciada pero el plan Premium ya no está activo (pago vencido o plan cancelado):
  // el progreso se conserva, pero el contenido queda pausado hasta renovar.
  if (!premium) {
    const paused = document.createElement('div');
    paused.className = 'card center';
    paused.innerHTML = `
      <div style="font-size:2.6rem">⏸️</div>
      <h2>Tu misión está pausada</h2>
      <p class="mt">${planExpired() ? 'Tu plan Premium venció y no se ha renovado.' : 'Tu plan Premium ya no está activo.'}
      Tu progreso (${(mision.completadas || []).length}/12 semanas) está guardado y te espera.</p>
      <button class="btn accent full mt">Renovar Premium y continuar</button>`;
    paused.querySelector('.btn').addEventListener('click', () => navigate('plans'));
    container.appendChild(paused);
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
          if (locked) { toast('Esta semana se desbloquea más adelante. Un cambio a la vez 🌱'); return; }
          openWeek(w, true, done, () => renderMission(clear(container)));
        }
      };
    });
    renderPathMap(list, items);

    if (completadas.length === 12) {
      const fin = document.createElement('div');
      fin.className = 'card center';
      fin.innerHTML = '<div style="font-size:3rem">🏆</div><h2>¡Misión cumplida!</h2><p>Doce semanas de cambios reales. Agenda tus exámenes de control y celebra tu progreso.</p>';
      container.appendChild(fin);
    }
  });
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
        done ? completadas.delete(week.n) : completadas.add(week.n);
        setState({ mision: { ...mision, completadas: [...completadas] } });
        close();
        if (onChange) onChange();
      });
      modal.appendChild(btn);
    }
  });
}

function clear(container) { container.innerHTML = ''; return container; }
