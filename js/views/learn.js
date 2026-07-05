// Aprende: micro-lecciones, glosario y claves por perfil.
import { LESSONS, GLOSSARY } from '../data/lessons.js';
import { PROFILES } from '../data/profiles.js';
import { getState } from '../store.js';
import { header, openModal } from '../app.js';

export function renderLearn(container) {
  header(container);
  const { user } = getState();

  // Claves de tus perfiles
  const keys = document.createElement('div');
  keys.className = 'card';
  keys.innerHTML = '<h2>🎯 Claves para tus perfiles</h2>';
  for (const pid of user.perfiles) {
    const p = PROFILES[pid];
    keys.insertAdjacentHTML('beforeend', `
      <h3 class="mt">${p.emoji} ${p.nombre}</h3>
      <p class="small">${p.objetivo}</p>
      <ul class="steps small">${p.claves.map((c) => `<li>${c}</li>`).join('')}</ul>`);
  }
  container.appendChild(keys);

  // Micro-lecciones
  const lessons = document.createElement('div');
  lessons.className = 'card';
  lessons.innerHTML = '<h2>📚 Micro-lecciones (3–5 min)</h2>';
  for (const l of LESSONS) {
    const item = document.createElement('button');
    item.className = 'recipe-item lesson-item';
    item.innerHTML = `
      <span class="recipe-emoji">${l.emoji}</span>
      <span class="info"><strong>${l.titulo}</strong><br><span class="muted small">${l.resumen}</span></span>
      <span>›</span>`;
    item.addEventListener('click', () => openModal((modal) => {
      modal.insertAdjacentHTML('beforeend', `
        <div style="font-size:2.4rem">${l.emoji}</div>
        <h2>${l.titulo}</h2>
        ${l.contenido.map((p) => `<p class="mt">${p}</p>`).join('')}`);
    }));
    lessons.appendChild(item);
  }
  container.appendChild(lessons);

  // Glosario
  const glos = document.createElement('div');
  glos.className = 'card';
  glos.innerHTML = '<h2>🔎 Glosario simple</h2>';
  for (const g of GLOSSARY) {
    glos.insertAdjacentHTML('beforeend', `
      <details class="glossary"><summary>${g.t}</summary><p>${g.d}</p></details>`);
  }
  container.appendChild(glos);

  const note = document.createElement('div');
  note.className = 'legal-note';
  note.textContent = 'Contenido educativo y de autoayuda. No constituye diagnóstico ni tratamiento médico.';
  container.appendChild(note);
}
