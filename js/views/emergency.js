// Plan de 7 días: respuesta inmediata y gratuita a un diagnóstico reciente.
// Termina con un CTA hacia la Misión 12 semanas (Premium).
import { EMERGENCY_PLAN } from '../data/emergencyPlan.js';
import { PROFILES } from '../data/profiles.js';
import { getState, setState, checkAchievements, today, esc, guardarReflexionDia, responderInvitacionTestimonioPlan } from '../store.js';
import { header, navigate, toast, openModal } from '../app.js';
import { renderPathMap } from '../pathMap.js';

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
  // Cuántos días han pasado desde que empezó (día de inicio = día 1), para
  // que cada día se desbloquee con el calendario y no se puedan adelantar.
  const diaDesbloqueado = Math.min(7, diasDesde(emergencia.inicio, today()) + 1);

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
  const items = EMERGENCY_PLAN.dias.map((d) => {
    const done = completados.includes(d.n);
    const locked = d.n > diaDesbloqueado;
    const isCurrent = d.n === diaDesbloqueado && !done;
    return {
      icon: d.emoji, title: `Día ${d.n}`, subtitle: d.titulo,
      done, now: isCurrent, locked, nowLabel: 'Hoy',
      onClick: () => {
        if (locked) { showVuelveManana(d); return; }
        openDia(d, done, () => renderEmergency(clear(container)));
      }
    };
  });
  renderPathMap(list, items);
  container.appendChild(list);
}

// Diferencia en días completos entre dos fechas YYYY-MM-DD (sin horas, sin
// líos de zona horaria: compara solo la fecha calendario).
function diasDesde(fechaInicio, fechaHoy) {
  const [y1, m1, d1] = fechaInicio.split('-').map(Number);
  const [y2, m2, d2] = fechaHoy.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// Mensaje cálido cuando intentan adelantarse a un día que aún no toca —
// celebra lo que ya hicieron en vez de solo bloquear.
function showVuelveManana(dia) {
  const overlay = document.createElement('div');
  overlay.className = 'streak-celebrate';
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = `
    <div class="ring"></div>
    <div class="flame-big">🌙</div>
    <div class="label wrap">Ya diste tu paso de hoy — vuelve mañana para el Día ${dia.n}</div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', () => overlay.remove());
  setTimeout(() => {
    overlay.style.animation = 'streak-fade-out 0.3s ease forwards';
    setTimeout(() => overlay.remove(), 320);
  }, 2600);
}

function openDia(dia, done, onChange) {
  openModal((modal, close) => {
    const { emergencia } = getState();
    const reflexionGuardada = (emergencia?.reflexiones || {})[dia.n] || '';
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2.4rem">${dia.emoji}</div>
      <h2>Día ${dia.n}: ${dia.titulo}</h2>
      <p class="mt"><strong>Objetivo:</strong> ${dia.objetivo}</p>
      <h3 class="mt">Hoy vas a…</h3>
      <ul class="steps">${dia.acciones.map((a) => `<li>${a}</li>`).join('')}</ul>
      <h3 class="mt">Para reflexionar</h3>
      <p>${dia.reflexion}</p>
      <label class="muted small mt" for="dia-reflexion" style="display:block">Escribe tu respuesta (mínimo 40 caracteres) para poder marcar el día como completado</label>
      <textarea id="dia-reflexion" maxlength="500" rows="3" placeholder="Escribe lo que quieras..."
        style="width:100%;padding:12px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit;margin-top:8px;resize:vertical">${esc(reflexionGuardada)}</textarea>`);
    const textarea = modal.querySelector('#dia-reflexion');
    const btn = document.createElement('button');
    btn.className = done ? 'btn ghost full mt' : 'btn full mt';
    btn.textContent = done ? '↩️ Desmarcar día' : '✅ Marcar día como completado';
    if (!done) {
      btn.disabled = !esTextoReal(textarea.value);
      textarea.addEventListener('input', () => { btn.disabled = !esTextoReal(textarea.value); });
    }
    btn.addEventListener('click', () => {
      guardarReflexionDia(dia.n, textarea.value);
      const { emergencia } = getState();
      const completados = new Set(emergencia.completados || []);
      done ? completados.delete(dia.n) : completados.add(dia.n);
      setState({ emergencia: { ...emergencia, completados: [...completados] } });
      const nuevos = checkAchievements();
      close();
      if (nuevos.includes('plan7_completo')) {
        toast('🎉 ¡Completaste tu plan de 7 días!');
        const { emergencia: e2 } = getState();
        if (!e2.testimonioPlanPreguntado) setTimeout(() => abrirInvitacionTestimonioPlan(), 500);
      }
      if (onChange) onChange();
    });
    modal.appendChild(btn);
  });
}

// Valida que sea una reflexión real, no relleno para pasar el mínimo:
// suficientes letras (no solo símbolos/números), variedad de caracteres
// (no "aaaaaaaa..." ni "jajajaja...") y al menos un espacio (una reflexión
// real casi siempre tiene más de una palabra).
function esTextoReal(texto) {
  const t = (texto || '').trim();
  if (t.length < 40) return false;
  const letras = t.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, '');
  if (letras.length < 25) return false;
  const unicas = new Set(letras.toLowerCase()).size;
  if (unicas < 8) return false;
  if (!/\s/.test(t)) return false;
  return true;
}

// Invitación cálida a compartir las reflexiones de la semana como
// testimonio — se pregunta UNA sola vez, justo al completar el día 7,
// el momento de mayor logro real, no en cada día.
function abrirInvitacionTestimonioPlan() {
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2rem">💛</div>
      <h2>Completaste tus 7 días</h2>
      <p class="small mt">Nos encantaría compartir lo que escribiste en tus reflexiones de esta semana — con tu nombre o de forma anónima, como prefieras — para inspirar a alguien que está empezando justo como tú hace una semana.
      Es completamente tu decisión, y no pasa nada si prefieres que quede solo entre nosotros.</p>
      <div class="row mt" style="gap:10px">
        <button class="btn ghost sm" id="tp-no">Prefiero que quede privado</button>
        <button class="btn sm" id="tp-si" style="flex:1">Sí, compartan mi historia 💛</button>
      </div>`);
    modal.querySelector('#tp-no').addEventListener('click', () => {
      responderInvitacionTestimonioPlan(false);
      close();
    });
    modal.querySelector('#tp-si').addEventListener('click', () => {
      responderInvitacionTestimonioPlan(true);
      close();
      toast('Gracias por confiar en nosotros 💛');
    });
  });
}

function clear(container) { container.innerHTML = ''; return container; }
