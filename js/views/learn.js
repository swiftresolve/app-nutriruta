// Aprende: micro-lecciones, glosario y claves por perfil.
import { LESSONS, GLOSSARY } from '../data/lessons.js';
import { PROFILES } from '../data/profiles.js';
import { getState, isPremium } from '../store.js';
import { header, openModal, navigate } from '../app.js';

// Lecciones incluidas en el plan gratuito.
const FREE_LESSONS = 2;

function colonTip(predominante) {
  return {
    diarrea: 'prioriza alimentos suaves y astringentes (arroz, plátano maduro, zanahoria cocida) y modera la fibra insoluble.',
    estrenimiento: 'sube la fibra soluble poco a poco (avena, chía, ciruela) y no olvides el agua.',
    mixto: 'observa qué predomina cada semana y ajusta: fibra suave siempre, más soluble si hay estreñimiento, más astringente si hay diarrea.'
  }[predominante] || '';
}

// Reglas cruzadas del documento de protocolos: combinaciones frecuentes de perfiles.
const COMBO_TIPS = [
  { perfiles: ['higado_graso', 'resistencia_insulina'], texto: '🫀🩸 <strong>Hígado graso + resistencia a la insulina:</strong> reducir azúcar y subir proteína es tu palanca más fuerte.' },
  { perfiles: ['colesterol', 'prediabetes'], texto: '❤️🛡️ <strong>Colesterol alto + prediabetes:</strong> sube la fibra soluble (avena, legumbres) y baja las harinas refinadas.' },
  { perfiles: ['gases', 'colon_irritable'], texto: '🎈🌱 <strong>Gases + colon irritable:</strong> cuida las porciones de cebolla, ajo y legumbres; sube la fibra despacio, no de golpe.' },
  { perfiles: ['colon_irritable', 'estrenimiento'], texto: '🌱🚰 <strong>Colon irritable + estreñimiento:</strong> prioriza fibra suave (avena, chía) y evita subirla de golpe para no irritar más.' },
  { perfiles: ['migranas'], habitos: ['hambre_emocional'], texto: '🧠💚 <strong>Migrañas + ansiedad por comida:</strong> evita ayunos largos y ten siempre a mano un snack estable en glucosa.' }
];

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
      <ul class="steps small">${p.claves.map((c) => `<li>${c}</li>`).join('')}</ul>
      ${pid === 'colon_irritable' && user.colonPredominante ? `<p class="small mt"><strong>Tu foco:</strong> ${colonTip(user.colonPredominante)}</p>` : ''}`);
  }
  container.appendChild(keys);

  // Combinaciones frecuentes: solo las que apliquen a tus perfiles activos.
  const combos = COMBO_TIPS.filter((c) =>
    c.perfiles.every((p) => user.perfiles.includes(p)) &&
    (c.habitos || []).every((h) => user.habitosDificiles.includes(h))
  );
  if (combos.length) {
    const comboCard = document.createElement('div');
    comboCard.className = 'card';
    comboCard.innerHTML = '<h2>🔗 Cuando se combinan tus perfiles</h2>';
    for (const c of combos) {
      comboCard.insertAdjacentHTML('beforeend', `<p class="small mt">${c.texto}</p>`);
    }
    container.appendChild(comboCard);
  }

  // Micro-lecciones
  const lessons = document.createElement('div');
  lessons.className = 'card';
  lessons.innerHTML = '<h2>📚 Micro-lecciones (3–5 min)</h2>';
  const premium = isPremium();
  LESSONS.forEach((l, i) => {
    const locked = !premium && i >= FREE_LESSONS;
    const item = document.createElement('button');
    item.className = 'recipe-item lesson-item';
    if (locked) item.style.opacity = '0.5';
    item.innerHTML = `
      <span class="recipe-emoji">${locked ? '🔒' : l.emoji}</span>
      <span class="info"><strong>${l.titulo}</strong><br><span class="muted small">${locked ? 'Disponible en el plan Premium' : l.resumen}</span></span>
      <span>›</span>`;
    item.addEventListener('click', () => {
      if (locked) { navigate('plans'); return; }
      openModal((modal) => {
        modal.insertAdjacentHTML('beforeend', `
          <div style="font-size:2.4rem">${l.emoji}</div>
          <h2>${l.titulo}</h2>
          ${l.contenido.map((p) => `<p class="mt">${p}</p>`).join('')}`);
      });
    });
    lessons.appendChild(item);
  });
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
