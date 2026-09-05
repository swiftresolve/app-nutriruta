// Panorama de una semana de la Misión 12 semanas -- pantalla propia (no
// modal), pedida explícitamente por la usuaria: al tocar una semana debe
// verse el objetivo completo, el desglose día por día (qué hacer cada uno
// de los 7 días) y la reflexión final, no solo una tarjeta plana con el
// título. Mismo estilo de "pantalla con header + Volver" que weekMenu.js
// (no el estilo de pantalla completa del quiz/SOS, la usuaria pidió dejar
// el Plan de 7 días y la Misión con estilos visuales distintos).
import { getState, setState, checkAchievements, today, esc, guardarReflexionSemana, responderInvitacionTestimonioMision, otorgarGemas, GEMAS_POR_DIA, sumarEnergiaRuta, esTextoReal } from '../store.js';
import { header, navigate, toast, openModal } from '../app.js';
import { celebrateMilestone } from '../streakAnim.js';
import { playCelebrateSound } from '../sound.js';

export function renderMissionWeek(container, { week, canComplete = false, done = false } = {}) {
  header(container);

  if (!week) { navigate('mission'); return; }

  const back = document.createElement('button');
  back.className = 'link-btn small';
  back.textContent = '← Volver a la Misión';
  back.addEventListener('click', () => navigate('mission'));
  container.appendChild(back);

  const { mision } = getState();
  const reflexionGuardada = (mision?.reflexiones || {})[week.n] || '';
  const dias = week.dias || [];

  const hero = document.createElement('div');
  hero.className = 'card center';
  hero.innerHTML = `
    <div style="font-size:2.4rem">${week.emoji}</div>
    <h2 class="mt">Semana ${week.n}: ${week.titulo}</h2>
    <p class="mt"><strong>Objetivo:</strong> ${week.objetivo}</p>`;
  container.appendChild(hero);

  if (dias.length) {
    const diasCard = document.createElement('div');
    diasCard.className = 'card';
    diasCard.innerHTML = `
      <h3>Tu semana, día a día</h3>
      <ul class="steps mt">
        ${dias.map((d) => `<li><strong>Día ${d.n}: ${d.titulo}</strong><br><span class="small muted">${d.accion}</span></li>`).join('')}
      </ul>`;
    container.appendChild(diasCard);
  } else if ((week.acciones || []).length) {
    const accionesCard = document.createElement('div');
    accionesCard.className = 'card';
    accionesCard.innerHTML = `
      <h3>Acciones de la semana</h3>
      <ul class="steps mt">${week.acciones.map((a) => `<li>${a}</li>`).join('')}</ul>`;
    container.appendChild(accionesCard);
  }

  const reflexionCard = document.createElement('div');
  reflexionCard.className = 'card';
  reflexionCard.innerHTML = `
    <h3>Para reflexionar</h3>
    <p>${week.reflexion}</p>`;
  if (canComplete) {
    reflexionCard.insertAdjacentHTML('beforeend', `
      <label class="muted small mt" for="semana-reflexion" style="display:block">Escribe tu respuesta (mínimo 40 caracteres) para poder marcar la semana como completada</label>
      <textarea id="semana-reflexion" maxlength="500" rows="3" placeholder="Escribe lo que quieras..."
        class="auth-input" style="resize:vertical">${esc(reflexionGuardada)}</textarea>`);
    const btn = document.createElement('button');
    btn.className = done ? 'btn ghost full mt' : 'btn full mt';
    btn.textContent = done ? '↩️ Desmarcar semana' : '✅ Marcar semana como completada';
    const textarea = reflexionCard.querySelector('#semana-reflexion');
    if (!done) {
      btn.disabled = !esTextoReal(textarea.value);
      textarea.addEventListener('input', () => { btn.disabled = !esTextoReal(textarea.value); });
    }
    btn.addEventListener('click', () => {
      guardarReflexionSemana(week.n, textarea.value);
      const { mision: m } = getState();
      const completadas = new Set(m.completadas || []);
      const completando = !done;
      done ? completadas.delete(week.n) : completadas.add(week.n);
      setState({
        mision: {
          ...m, completadas: [...completadas],
          ultimaCompletadaFecha: completando ? today() : m.ultimaCompletadaFecha
        }
      });
      const nuevos = checkAchievements();
      if (completando) {
        const gemasSemana = GEMAS_POR_DIA * 3;
        otorgarGemas(gemasSemana);
        sumarEnergiaRuta(8, 5); // "Completar misión semanal"
        playCelebrateSound();
        celebrateMilestone(`¡Semana ${week.n} completada!`, `${week.titulo} · +${gemasSemana} 💎`);
      }
      if (nuevos.includes('mision12_completo')) {
        toast('🏆 ¡Completaste las 12 semanas de la Misión!');
        const { mision: m2 } = getState();
        if (!m2.testimonioMisionPreguntado) setTimeout(() => abrirInvitacionTestimonioMision(), 500);
      }
      navigate('mission');
    });
    reflexionCard.appendChild(btn);
  }
  container.appendChild(reflexionCard);
}

// Invitación cálida a compartir las reflexiones de la Misión como
// testimonio -- se pregunta UNA sola vez, justo al completar la semana 12,
// misma idea que abrirInvitacionTestimonioPlan() en emergency.js.
function abrirInvitacionTestimonioMision() {
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2rem">🏆</div>
      <h2>Completaste tu Misión</h2>
      <p class="small mt">Nos encantaría compartir lo que escribiste en tus reflexiones de estas 12 semanas — con tu nombre o de forma anónima, como prefieras — para inspirar a alguien que está empezando su propia misión.
      Es completamente tu decisión, y no pasa nada si prefieres que quede solo entre nosotros.</p>
      <div class="row mt" style="gap:10px">
        <button class="btn ghost sm" id="tm-no">Prefiero que quede privado</button>
        <button class="btn sm" id="tm-si" style="flex:1">Sí, compartan mi historia 💛</button>
      </div>`);
    modal.querySelector('#tm-no').addEventListener('click', () => {
      responderInvitacionTestimonioMision(false);
      close();
    });
    modal.querySelector('#tm-si').addEventListener('click', () => {
      responderInvitacionTestimonioMision(true);
      close();
      toast('Gracias por confiar en nosotros 💛');
    });
  });
}
