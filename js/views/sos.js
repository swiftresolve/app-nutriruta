// SOS antojo: pausa guiada, alternativas y registro del episodio.
import { logCraving, checkAchievements, getState } from '../store.js';
import { sosSnacks, displayRecipe } from '../menu.js';
import { header, toast, navigate } from '../app.js';
import { openRecipe } from './dashboard.js';

const CRAVING_TYPES = [
  { id: 'dulce', nombre: '🍫 Dulce' },
  { id: 'salado', nombre: '🍟 Salado / paquete' },
  { id: 'alcohol', nombre: '🍺 Alcohol' },
  { id: 'picoteo', nombre: '🌙 Picoteo nocturno' },
  { id: 'no_se', nombre: '🤷‍♀️ No sé, solo ansiedad' }
];

export function renderSOS(container) {
  header(container);
  let tipo = null;

  const hero = document.createElement('div');
  hero.className = 'sos-hero';
  hero.innerHTML = `
    <h2>Respira. Estás bien. 💚</h2>
    <p>No es falta de fuerza de voluntad: es un momento, y va a pasar. Vamos paso a paso.</p>`;
  container.appendChild(hero);

  // Paso 1: identificar el antojo
  const step1 = document.createElement('div');
  step1.className = 'card';
  step1.innerHTML = '<h3>1. ¿Qué tipo de antojo sientes?</h3><div class="chips mt"></div>';
  const chipWrap = step1.querySelector('.chips');
  for (const t of CRAVING_TYPES) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = t.nombre;
    b.addEventListener('click', () => {
      tipo = t.id;
      chipWrap.querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c === b));
    });
    chipWrap.appendChild(b);
  }
  container.appendChild(step1);

  // Paso 2: pausa consciente
  const step2 = document.createElement('div');
  step2.className = 'card center';
  step2.innerHTML = `
    <h3>2. La pausa de 1 minuto</h3>
    <p class="small">Antes de decidir, toma un vaso de agua y respira conmigo 5 veces.</p>
    <div class="breath-circle" id="breath">Presiona<br>para empezar</div>
    <p class="small muted" id="breath-label"></p>`;
  container.appendChild(step2);

  const circle = step2.querySelector('#breath');
  const label = step2.querySelector('#breath-label');
  let breathing = false;
  circle.addEventListener('click', () => {
    if (breathing) return;
    breathing = true;
    let cycle = 0;
    const doCycle = () => {
      if (cycle >= 5) {
        circle.classList.remove('in');
        circle.innerHTML = '¡Bien hecho! 🌿';
        label.textContent = '¿Cómo te sientes ahora?';
        breathing = false;
        return;
      }
      cycle++;
      circle.classList.add('in');
      circle.textContent = 'Inhala…';
      setTimeout(() => {
        circle.classList.remove('in');
        circle.textContent = 'Exhala…';
        label.textContent = `Respiración ${cycle} de 5`;
        setTimeout(doCycle, 3500);
      }, 3500);
    };
    doCycle();
  });

  // Paso 3: pregunta hambre física vs emocional
  const step3 = document.createElement('div');
  step3.className = 'card';
  step3.innerHTML = `
    <h3>3. ¿Hambre física o emocional?</h3>
    <p class="small">Hambre física: llegó poco a poco y aceptarías cualquier comida.<br>
    Hambre emocional: llegó de golpe y pide algo muy específico.</p>`;
  container.appendChild(step3);

  // Paso 4: alternativas
  const step4 = document.createElement('div');
  step4.className = 'card';
  step4.innerHTML = '<h3>4. Elige tu alternativa saludable</h3><p class="small mb">Aptas para tus perfiles y exclusiones:</p>';
  const { exclusiones } = getState().user;
  for (const r of sosSnacks().slice(0, 5)) {
    const shown = displayRecipe(r, exclusiones);
    const item = document.createElement('button');
    item.className = 'recipe-item';
    item.innerHTML = `
      <span class="recipe-emoji">${shown.emoji}</span>
      <span class="info"><strong>${shown.nombre}</strong><br><span class="muted small">${r.descripcion}</span></span>`;
    item.addEventListener('click', () => openRecipe(r));
    step4.appendChild(item);
  }
  container.appendChild(step4);

  // Paso 5: registrar resultado
  const step5 = document.createElement('div');
  step5.className = 'card';
  step5.innerHTML = '<h3>5. Registra cómo terminó</h3><p class="small mb">Registrar te ayuda a detectar tus patrones. Sin culpa: todo dato sirve.</p>';
  const okBtn = document.createElement('button');
  okBtn.className = 'btn full mb';
  okBtn.textContent = '✅ Usé una alternativa saludable';
  okBtn.addEventListener('click', () => {
    logCraving(tipo || 'no_se', 'alternativa');
    checkAchievements();
    toast('💚 Registrado. ¡Cada vez que eliges distinto, reentrenas tu hábito!');
    navigate('dashboard');
  });
  const cedioBtn = document.createElement('button');
  cedioBtn.className = 'btn ghost full';
  cedioBtn.textContent = '🤍 Esta vez cedí al antojo';
  cedioBtn.addEventListener('click', () => {
    logCraving(tipo || 'no_se', 'cedio');
    toast('Está bien. Progreso, no perfección. Mañana seguimos 💛');
    navigate('dashboard');
  });
  step5.appendChild(okBtn);
  step5.appendChild(cedioBtn);
  container.appendChild(step5);
}
