// Check-in de seguimiento: breve, siempre pospuesto si el usuario quiere,
// nunca bloquea el uso de la app. Aparece cada ~3 días de uso activo.
import { shouldShowCheckin, postponeCheckin, logCheckin, responderInvitacionTestimonio } from '../store.js';
import { openModal, toast } from '../app.js';

const ANIMOS = [
  { id: 'dificil', label: '🙁 Difícil' },
  { id: 'normal', label: '😐 Normal' },
  { id: 'bien', label: '🙂 Bien' },
  { id: 'muy_bien', label: '😄 Muy bien' }
];

const IMPULSOS = [
  { id: '0', label: '0' },
  { id: '1-2', label: '1–2' },
  { id: '3-5', label: '3–5' },
  { id: '6+', label: '6+' }
];

const EXPERIENCIA_MENU = [
  { id: 'no_me_gusto', label: '👎 No me gustó' },
  { id: 'neutral', label: '😐 Neutral' },
  { id: 'me_gusto', label: '👍 Me gustó' },
  { id: 'me_encanto', label: '🤩 Me encantó' }
];

// Se llama solo al entrar a Hoy (navigate), no en los re-renders internos
// del dashboard al marcar un hábito o un vaso de agua, para no reabrir el
// modal en cada clic.
export function maybeShowCheckin() {
  if (!shouldShowCheckin()) return;
  // Pequeña pausa para que no aparezca encima de la primera pintura del dashboard.
  setTimeout(abrirCheckin, 600);
}

function chipGroup(wrap, options, onPick) {
  let picked = null;
  for (const o of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = o.label;
    b.addEventListener('click', () => {
      picked = o.id;
      wrap.querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c === b));
      onPick(picked);
    });
    wrap.appendChild(b);
  }
  return () => picked;
}

function abrirCheckin() {
  let animo = null, impulsos = null, experiencia = null;
  openModal((modal, close) => {
    const cerrarYPosponer = () => { postponeCheckin(); close(); };
    modal.insertAdjacentHTML('beforeend', `
      <h2>👋 ¿Cómo vas?</h2>
      <p class="small mt">Dos minutos, para acompañarte mejor. Puedes saltarlo si no es buen momento.</p>
      <p class="small mt" style="font-weight:600">¿Cómo te has sentido?</p>
      <div class="chips mt" id="ci-animo"></div>
      <p class="small mt" style="font-weight:600">¿Cuántos impulsos de antojo tuviste?</p>
      <div class="chips mt" id="ci-impulsos"></div>
      <p class="small mt" style="font-weight:600">¿Qué tal el menú de estos días?</p>
      <div class="chips mt" id="ci-menu"></div>
      <label class="muted small mt" for="ci-notas" style="display:block">¿Algo más que quieras contarnos? (opcional)</label>
      <textarea id="ci-notas" maxlength="300" rows="3" placeholder="Cuéntanos lo que quieras…"
        style="width:100%;padding:12px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit;margin-top:8px;resize:vertical"></textarea>
      <div class="row mt" style="gap:10px">
        <button class="btn ghost sm" id="ci-posponer">Ahora no</button>
        <button class="btn sm" id="ci-enviar" disabled style="flex:1">Enviar</button>
      </div>`);

    const enviarBtn = modal.querySelector('#ci-enviar');
    const actualizarBoton = () => { enviarBtn.disabled = !(animo && impulsos && experiencia); };

    chipGroup(modal.querySelector('#ci-animo'), ANIMOS, (v) => { animo = v; actualizarBoton(); });
    chipGroup(modal.querySelector('#ci-impulsos'), IMPULSOS, (v) => { impulsos = v; actualizarBoton(); });
    chipGroup(modal.querySelector('#ci-menu'), EXPERIENCIA_MENU, (v) => { experiencia = v; actualizarBoton(); });

    modal.querySelector('#ci-posponer').addEventListener('click', cerrarYPosponer);

    enviarBtn.addEventListener('click', () => {
      if (!(animo && impulsos && experiencia)) return;
      const notas = modal.querySelector('#ci-notas').value;
      const index = logCheckin({ animo, antojosImpulsos: impulsos, menuExperiencia: experiencia, notas });
      close();
      toast('Gracias por contarnos cómo vas 🌱');
      const positivo = (animo === 'bien' || animo === 'muy_bien') && (experiencia === 'me_gusto' || experiencia === 'me_encanto');
      if (positivo) setTimeout(() => abrirInvitacionTestimonio(index), 500);
    });
  });
}

function abrirInvitacionTestimonio(index) {
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2rem">💛</div>
      <h2>Nos alegra mucho leer esto</h2>
      <p class="small mt">Estamos reuniendo historias reales para acompañar a personas que están empezando, como tú al inicio.
      Si te nace, nos encantaría compartir lo que nos cuentas en redes o en la página — con tu nombre o de forma anónima, como prefieras.
      Es completamente tu decisión, y no pasa nada si prefieres que quede solo entre nosotros.</p>
      <div class="row mt" style="gap:10px">
        <button class="btn ghost sm" id="ti-no">Prefiero que quede privado</button>
        <button class="btn sm" id="ti-si" style="flex:1">Sí, compartan mi experiencia 💛</button>
      </div>`);
    modal.querySelector('#ti-no').addEventListener('click', () => {
      responderInvitacionTestimonio(index, false);
      close();
    });
    modal.querySelector('#ti-si').addEventListener('click', () => {
      responderInvitacionTestimonio(index, true);
      close();
      toast('Gracias por confiar en nosotros 💛');
    });
  });
}

export function labelAnimo(id) {
  return (ANIMOS.find((a) => a.id === id) || {}).label || id;
}

export function labelImpulsos(id) {
  return (IMPULSOS.find((i) => i.id === id) || {}).label || id;
}

export function labelExperiencia(id) {
  return (EXPERIENCIA_MENU.find((e) => e.id === id) || {}).label || id;
}
