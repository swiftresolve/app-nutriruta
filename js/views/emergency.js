// Plan de 7 días: respuesta inmediata y gratuita a un diagnóstico reciente.
// Termina con un CTA hacia la Misión 12 semanas (Premium).
import { EMERGENCY_PLAN } from '../data/emergencyPlan.js';
import { PROFILES } from '../data/profiles.js';
import { getState, setState, checkAchievements, today, esc } from '../store.js';
import { header, navigate, toast, openModal } from '../app.js';

export function renderEmergency(container) {
  header(container);
  const { user, emergencia } = getState();

  const hero = document.createElement('div');
  hero.className = 'sos-hero';
  const topPerfil = user.perfiles[0] ? PROFILES[user.perfiles[0]] : null;
  hero.innerHTML = `
    <h2>🏁 ${EMERGENCY_PLAN.nombre}</h2>
    <p>${topPerfil ? `Sabemos que lo de ${esc(topPerfil.nombre.toLowerCase())} preocupa. ` : ''}${EMERGENCY_PLAN.descripcion}</p>`;
  container.appendChild(hero);

  // Sin plan iniciado
  if (!emergencia || !emergencia.inicio) {
    const start = document.createElement('div');
    start.className = 'card center';
    start.innerHTML = `
      <p>Siete días, un paso concreto cada día. Gratis, sin letra pequeña.</p>
      <button class="btn accent full mt">🚀 Empezar mi plan de 7 días</button>`;
    start.querySelector('.btn').addEventListener('click', () => {
      setState({ emergencia: { inicio: today(), completados: [] } });
      toast('¡Empezamos! Día 1: ' + EMERGENCY_PLAN.dias[0].titulo);
      renderEmergency(clear(container));
    });
    container.appendChild(start);
    return;
  }

  const completados = emergencia.completados || [];

  // Plan completado: cierre + CTA a la Misión
  if (completados.length >= 7) {
    const fin = document.createElement('div');
    fin.className = 'card center';
    fin.innerHTML = `
      <div style="font-size:3rem">🎉</div>
      <h2>¡Diste el primer paso!</h2>
      <p class="mt">Siete días de cambios reales, sin esperar a nadie. Si quieres sostener esto en el tiempo, la Misión 12 semanas te lleva al siguiente nivel, un cambio a la vez.</p>
      <button class="btn accent full mt">Ver Misión 12 semanas →</button>`;
    fin.querySelector('.btn').addEventListener('click', () => navigate('mission'));
    container.appendChild(fin);
  }

  const prog = document.createElement('div');
  prog.className = 'card';
  prog.innerHTML = `
    <div class="spread"><h2>Tu semana</h2><span class="tag info">${completados.length}/7</span></div>
    <div class="quiz-progress mt"><div style="width:${Math.round((completados.length / 7) * 100)}%"></div></div>`;
  container.appendChild(prog);

  const list = document.createElement('div');
  list.className = 'card';
  for (const d of EMERGENCY_PLAN.dias) {
    const done = completados.includes(d.n);
    const item = document.createElement('button');
    item.className = 'recipe-item';
    item.innerHTML = `
      <span class="recipe-emoji">${done ? '✅' : d.emoji}</span>
      <span class="info"><strong>Día ${d.n}: ${d.titulo}</strong><br><span class="muted small">${d.objetivo}</span></span><span>›</span>`;
    item.addEventListener('click', () => openDia(d, done, () => renderEmergency(clear(container))));
    list.appendChild(item);
  }
  container.appendChild(list);
}

function openDia(dia, done, onChange) {
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2.4rem">${dia.emoji}</div>
      <h2>Día ${dia.n}: ${dia.titulo}</h2>
      <p class="mt"><strong>Objetivo:</strong> ${dia.objetivo}</p>
      <h3 class="mt">Hoy vas a…</h3>
      <ul class="steps">${dia.acciones.map((a) => `<li>${a}</li>`).join('')}</ul>
      <h3 class="mt">Para reflexionar</h3>
      <p>${dia.reflexion}</p>`);
    const btn = document.createElement('button');
    btn.className = done ? 'btn ghost full mt' : 'btn full mt';
    btn.textContent = done ? '↩️ Desmarcar día' : '✅ Marcar día como completado';
    btn.addEventListener('click', () => {
      const { emergencia } = getState();
      const completados = new Set(emergencia.completados || []);
      done ? completados.delete(dia.n) : completados.add(dia.n);
      setState({ emergencia: { ...emergencia, completados: [...completados] } });
      const nuevos = checkAchievements();
      close();
      if (nuevos.includes('plan7_completo')) toast('🎉 ¡Completaste tu plan de 7 días!');
      if (onChange) onChange();
    });
    modal.appendChild(btn);
  });
}

function clear(container) { container.innerHTML = ''; return container; }
