// Misión 12 semanas (función premium).
// El contenido de las semanas se pide al servidor, que solo entrega lo que el
// plan del usuario permite (semana 1 gratis; 2–12 con Premium vigente).
import { MISSION } from '../data/mission.js';
import { fetchMissionWeeks, fetchMissionIndex } from '../supabase-client.js';
import { getState, setState, isPremium, planExpired, today } from '../store.js';
import { header, navigate, toast } from '../app.js';
import { renderPathMap } from '../pathMap.js';
import { celebrateMilestone } from '../streakAnim.js';
import { t } from '../i18n.js';

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
    <h2>🧭 ${t(MISSION.nombre)}</h2>
    <p>${t(MISSION.descripcion)}</p>`;
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
      ? `<p class="small">⏸️ <strong>${t('Tu plan Premium venció.')}</strong> ${t('Tu progreso ({n}/12 semanas) está guardado y te espera. Renueva para continuar donde ibas.', { n: completadasFree })}</p>
         <button class="btn accent full mt">${t('Renovar Premium')}</button>`
      : `<p class="small">✨ ${t('La {strong}Semana 1 es gratis{fin} — pruébala hoy mismo. Las demás se desbloquean con el {strong}plan Premium{fin}.', { strong: '<strong>', fin: '</strong>' })}</p>
         <button class="btn accent full mt">${t('Desbloquear las 12 semanas')}</button>`;
    note.querySelector('.btn').addEventListener('click', () => navigate('plans'));
    container.appendChild(note);

    const list = document.createElement('div');
    list.className = 'card';
    list.innerHTML = `<p class="muted small center">${t('Cargando el mapa de tu misión…')}</p>`;
    container.appendChild(list);

    loadIndex().then((idx) => {
      list.innerHTML = '';
      if (!idx.length) {
        list.innerHTML = `<p class="center">${t('No se pudo cargar el contenido. Revisa tu conexión e inténtalo de nuevo.')}</p>`;
        return;
      }
      const completadas = mision?.completadas || [];
      const items = idx.map((w) => ({
        icon: w.emoji, title: t('Semana {n}', { n: w.n }), subtitle: w.titulo,
        done: completadas.includes(w.n),
        now: w.gratis && !completadas.includes(w.n),
        locked: !w.gratis,
        nowLabel: t('Gratis'),
        onClick: async () => {
          if (!w.gratis) {
            toast(t('✨ Esta semana es parte del plan Premium.'));
            navigate('plans');
            return;
          }
          const weeks = await loadWeeks();
          const full = weeks.find((x) => x.n === w.n);
          if (full) navigate('missionWeek', { week: full, canComplete: false });
          else toast(t('No se pudo cargar la semana. Revisa tu conexión.'));
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
      <p>${t('Doce semanas, un cambio por semana. Cada semana tiene un objetivo claro, acciones concretas y una reflexión.')}</p>
      <button class="btn accent full mt">🚀 ${t('Empezar mi misión')}</button>`;
    start.querySelector('.btn').addEventListener('click', () => {
      setState({ mision: { inicio: today(), completadas: [] } });
      toast(t('¡Misión iniciada! Un cambio a la vez 🌱'));
      renderMission(clear(container));
    });
    container.appendChild(start);
    return;
  }

  // Misión en curso
  const inicio = new Date(mision.inicio + 'T00:00:00');
  let semanaActual = Math.min(12, Math.floor((Date.now() - inicio.getTime()) / (7 * 86400000)) + 1);
  const completadas = mision.completadas || [];
  // Mismo tope que el Plan de 7 días: la semana activa nunca es más
  // adelantada que la siguiente pendiente real (aunque el calendario ya
  // habilite varias de corrido, ej. si no abriste la app en varias
  // semanas), y nunca más de una semana completada por día real.
  const semanaSiguientePendiente = Array.from({ length: 12 }, (_, i) => i + 1).find((n) => !completadas.includes(n)) ?? 13;
  semanaActual = Math.min(semanaActual, semanaSiguientePendiente);
  const yaCompletoHoy = mision.ultimaCompletadaFecha === today();
  if (yaCompletoHoy && !completadas.includes(semanaActual)) semanaActual = 0;

  const prog = document.createElement('div');
  prog.className = 'card';
  prog.innerHTML = `
    <div class="spread"><h2>${t('Semana {n} de 12', { n: semanaActual })}</h2><span class="tag info">${t('{n}/12 completadas', { n: completadas.length })}</span></div>
    <div class="quiz-progress mt"><div style="width:${Math.round((completadas.length / 12) * 100)}%"></div></div>`;
  container.appendChild(prog);

  const list = document.createElement('div');
  list.className = 'card';
  list.innerHTML = `<p class="muted small center">${t('Cargando tu misión…')}</p>`;
  container.appendChild(list);

  loadWeeks().then((weeks) => {
    list.innerHTML = '';
    if (!weeks.length) {
      list.innerHTML = `<p class="center">${t('No se pudo cargar el contenido. Revisa tu conexión e inténtalo de nuevo.')}</p>`;
      return;
    }
    const items = weeks.map((w) => {
      const done = completadas.includes(w.n);
      const isCurrent = w.n === semanaActual;
      const locked = w.n > semanaActual;
      return {
        icon: w.emoji, title: t('Semana {n}', { n: w.n }), subtitle: w.titulo,
        done, now: isCurrent, locked, nowLabel: t('Actual'),
        onClick: () => {
          if (locked) { mostrarSemanaBloqueada(w, inicio); return; }
          navigate('missionWeek', { week: w, canComplete: true, done });
        }
      };
    });
    renderTramos(list, items);

    if (completadas.length === 12) {
      const fin = document.createElement('div');
      fin.className = 'card center';
      fin.innerHTML = `<div style="font-size:3.4rem">🏆</div><h2 class="mt">${t('¡Misión cumplida!')}</h2><p class="mt">${t('Doce semanas de cambios reales. Agenda tus exámenes de control y celebra tu progreso.')}</p>`;
      container.appendChild(fin);
    }
  });
}

// Agrupa las semanas en tramos de 3 (como paradas de una expedición) SOLO
// para los banners de checkpoint -- el camino en sí es UNO SOLO, continuo,
// de las 12 semanas reales (pedido explícito: "debe ser una curva
// completa, no cortada por semana"). Antes cada tramo tenía su propio
// renderPathMap (su propia curva independiente, que se notaba cortada en
// cada salto de tramo); ahora es una sola llamada con las 12, y los
// banners se insertan DESPUÉS, como divisores visuales entre las filas ya
// pintadas -- no parten el camino en pedazos.
const TRAMO_SIZE = 3;
function renderTramos(container, items) {
  container.innerHTML = '';
  const camino = document.createElement('div');
  container.appendChild(camino);
  let activeIndex = items.findIndex((it) => it.now);
  if (activeIndex !== -1 && items[activeIndex].done && activeIndex < items.length - 1) activeIndex += 1;
  // skipSegments: el tramo justo donde va un banner divisor ("Tramo 2 ·
  // Semanas 4-6", etc.) no debe tener línea -- ni color ni gris, un hueco
  // real. Esos tramos son los que conectan el último nodo de un grupo de
  // 3 con el primero del siguiente (índices TRAMO_SIZE-1, 2*TRAMO_SIZE-1...).
  const skipSegments = [];
  for (let i = TRAMO_SIZE; i < items.length; i += TRAMO_SIZE) skipSegments.push(i - 1);
  renderPathMap(camino, items, { showLine: true, activeIndex: activeIndex === -1 ? undefined : activeIndex, rowGap: 40, skipSegments });
  // Semana 8 (nodo 7) un poco más separada verticalmente de Semana 9 --
  // pedido puntual, solo en la lista real de 12 semanas.
  if (items.length === 12) {
    const filaSemana8 = camino.querySelector('.path-row[data-row-idx="7"]');
    if (filaSemana8) filaSemana8.style.marginBottom = '60px';
  }
  // Los banners se insertan ya con las filas en el DOM (renderPathMap
  // arma su innerHTML de forma síncrona) -- antes de que corra el
  // requestAnimationFrame que mide alturas y dibuja la curva, así esa
  // medición ya incluye el espacio real que ocupan los banners.
  for (let i = 0; i < items.length; i += TRAMO_SIZE) {
    const grupo = items.slice(i, i + TRAMO_SIZE);
    const tramoN = i / TRAMO_SIZE + 1;
    const desde = i + 1, hasta = Math.min(i + TRAMO_SIZE, items.length);
    const grupoCompleto = grupo.every((it) => it.done);
    const banner = document.createElement('div');
    banner.className = 'tramo-banner' + (grupoCompleto ? ' done' : '');
    banner.innerHTML = `<span class="tramo-badge">${grupoCompleto ? '🏅' : tramoN}</span><span class="tramo-label">${t('Tramo {n} · Semanas {desde}-{hasta}', { n: tramoN, desde, hasta })}</span>`;
    const filaInicio = camino.querySelector(`.path-row[data-row-idx="${i}"]`);
    filaInicio.parentElement.insertBefore(banner, filaInicio);
  }
}

// Mensaje cálido con el número real de días que faltan (no un genérico
// "más adelante") cuando se toca una semana que aún no toca por calendario.
function mostrarSemanaBloqueada(week, inicio) {
  const msDesbloqueo = inicio.getTime() + (week.n - 1) * 7 * 86400000;
  const diasFaltan = Math.max(1, Math.ceil((msDesbloqueo - Date.now()) / 86400000));
  celebrateMilestone(t('Semana {n} llega en {dias} día{s}', { n: week.n, dias: diasFaltan, s: diasFaltan === 1 ? '' : 's' }), t('Un cambio a la vez — disfruta la semana actual primero 🌱'));
}

function clear(container) { container.innerHTML = ''; return container; }
