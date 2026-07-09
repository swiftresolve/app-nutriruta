// Mi progreso: rachas, logros, historial de antojos y diario de síntomas.
import { getState, ACHIEVEMENTS, logSintoma, sintomaPattern, esc } from '../store.js';
import { SYMPTOM_TYPES } from '../data/profiles.js';
import { header, openModal, toast } from '../app.js';

export function renderProgress(container) {
  header(container);
  const { racha, diasCumplidos, logros, antojos, sintomas } = getState();

  // Racha
  const streak = document.createElement('div');
  streak.className = 'card streak-hero';
  streak.innerHTML = `
    <div class="num">${racha.actual} 🔥</div>
    <p><strong>días seguidos</strong> cumpliendo tus hábitos</p>
    <p class="small muted mt">Mejor racha: ${racha.mejor} días · Total de días cumplidos: ${diasCumplidos.length}</p>`;
  container.appendChild(streak);

  // Impacto
  const impact = document.createElement('div');
  impact.className = 'card';
  impact.innerHTML = `
    <h2>🌱 Tu impacto</h2>
    <p class="small">Si mantienes estos hábitos, ayudas a tu glucosa, tu hígado y tu colesterol.
    Los cambios sostenidos por 12 semanas pueden reflejarse en tus próximos exámenes. Recuerda revisarlos siempre con tu profesional de salud.</p>`;
  container.appendChild(impact);

  // Logros
  const badges = document.createElement('div');
  badges.className = 'card';
  badges.innerHTML = '<h2>🏆 Logros</h2><div class="badges mt"></div>';
  const grid = badges.querySelector('.badges');
  for (const a of ACHIEVEMENTS) {
    const unlocked = logros.includes(a.id);
    const b = document.createElement('div');
    b.className = 'badge' + (unlocked ? '' : ' locked');
    b.title = a.desc;
    b.innerHTML = `<div class="emoji">${a.emoji}</div><span class="small"><strong>${a.nombre}</strong></span>`;
    grid.appendChild(b);
  }
  container.appendChild(badges);

  // Antojos
  const sos = document.createElement('div');
  sos.className = 'card';
  const superados = antojos.filter((a) => a.resultado === 'alternativa').length;
  sos.innerHTML = `<h2>💚 Tus antojos</h2>
    <p class="small">${antojos.length ? `Registrados: ${antojos.length} · Superados con alternativa: <strong>${superados}</strong>` : 'Aún no registras antojos. Cuando llegue uno, usa el botón SOS.'}</p>`;
  if (antojos.length) {
    const last = [...antojos].slice(-6).reverse();
    for (const a of last) {
      const row = document.createElement('div');
      row.className = 'habit';
      row.innerHTML = `<span>${a.resultado === 'alternativa' ? '✅' : '🤍'}</span>
        <label>${a.fecha} · ${a.hora} · ${labelTipo(a.tipo)}</label>`;
      sos.appendChild(row);
    }
  }
  container.appendChild(sos);

  // Diario de síntomas (detector de disparadores)
  const diario = document.createElement('div');
  diario.className = 'card';
  const patron = sintomaPattern();
  let patronHtml = '';
  if (patron) {
    patronHtml = patron.tipo === 'disparador'
      ? `<p class="small mt" style="border-left:4px solid var(--accent);padding-left:10px">💡 <strong>Hemos notado</strong> que <strong>${esc(patron.valor)}</strong> aparece seguido en tus registros. Puede ser tu disparador.</p>`
      : `<p class="small mt" style="border-left:4px solid var(--accent);padding-left:10px">💡 <strong>Hemos notado</strong> que tus síntomas suelen aparecer en la <strong>${patron.valor}</strong>.</p>`;
  }
  diario.innerHTML = `
    <div class="spread"><h2>📋 Diario de síntomas</h2></div>
    <p class="small">${sintomas.length ? `Registrados: ${sintomas.length}` : 'Registra gases, hinchazón, estreñimiento, diarrea o migraña, y con el tiempo te ayudamos a ver qué los dispara.'}</p>
    ${patronHtml}
    <button class="btn quiet sm mt" id="btn-log-sintoma">+ Registrar síntoma</button>`;
  diario.querySelector('#btn-log-sintoma').addEventListener('click', () => openSintomaModal(() => {
    renderProgress(clear(container));
  }));
  if (sintomas.length) {
    const last = [...sintomas].slice(-6).reverse();
    for (const s of last) {
      const row = document.createElement('div');
      row.className = 'habit';
      row.innerHTML = `<span>${labelTipoSintoma(s.tipo).split(' ')[0]}</span>
        <label>${s.fecha} · ${s.hora} · ${labelTipoSintoma(s.tipo)}${s.disparador ? ` · <span class="muted">${esc(s.disparador)}</span>` : ''}</label>`;
      diario.appendChild(row);
    }
  }
  container.appendChild(diario);
}

function clear(container) {
  container.innerHTML = '';
  return container;
}

function openSintomaModal(onSaved) {
  let tipo = null;
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <h2>📋 Registrar síntoma</h2>
      <p class="small mt">¿Qué sentiste?</p>
      <div class="chips mt" id="sintoma-chips"></div>
      <label class="muted small mt" for="sintoma-disparador" style="display:block">¿Sospechas qué lo causó? (opcional)</label>
      <input id="sintoma-disparador" type="text" maxlength="60" placeholder="Ej: cebolla, lácteos, estrés…"
        style="width:100%;padding:12px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit;margin-top:8px">
      <button class="btn full mt" id="sintoma-guardar" disabled>Guardar</button>`);
    const chipWrap = modal.querySelector('#sintoma-chips');
    const guardarBtn = modal.querySelector('#sintoma-guardar');
    for (const t of SYMPTOM_TYPES) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = `${t.emoji} ${t.nombre}`;
      b.addEventListener('click', () => {
        tipo = t.id;
        chipWrap.querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c === b));
        guardarBtn.disabled = false;
      });
      chipWrap.appendChild(b);
    }
    guardarBtn.addEventListener('click', () => {
      if (!tipo) return;
      const disparador = modal.querySelector('#sintoma-disparador').value;
      logSintoma(tipo, disparador);
      close();
      toast('Registrado. Cada dato te ayuda a entender tu cuerpo 🌱');
      if (onSaved) onSaved();
    });
  });
}

function labelTipo(t) {
  return { dulce: 'Antojo de dulce', salado: 'Antojo salado', alcohol: 'Alcohol', picoteo: 'Picoteo nocturno', no_se: 'Ansiedad general' }[t] || t;
}

function labelTipoSintoma(t) {
  const found = SYMPTOM_TYPES.find((s) => s.id === t);
  return found ? `${found.emoji} ${found.nombre}` : t;
}
