// Mi progreso: rachas, logros e historial de antojos.
import { getState, ACHIEVEMENTS } from '../store.js';
import { header } from '../app.js';

export function renderProgress(container) {
  header(container);
  const { racha, diasCumplidos, logros, antojos } = getState();

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
}

function labelTipo(t) {
  return { dulce: 'Antojo de dulce', salado: 'Antojo salado', alcohol: 'Alcohol', picoteo: 'Picoteo nocturno', no_se: 'Ansiedad general' }[t] || t;
}
