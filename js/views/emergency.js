// Plan de 7 días: respuesta inmediata y gratuita a un diagnóstico reciente.
// Termina con un CTA hacia la Misión 12 semanas (Premium).
import { EMERGENCY_PLAN } from '../data/emergencyPlan.js';
import { PROFILES } from '../data/profiles.js';
import { getState, setState, checkAchievements, today, esc, guardarReflexionDia, responderInvitacionTestimonioPlan, otorgarGemas, GEMAS_POR_DIA, GEMAS_BONUS_HITO, sumarEnergiaRuta, esTextoReal } from '../store.js';
import { header, navigate, toast, openModal } from '../app.js';
import { renderPathMap } from '../pathMap.js';
import { celebrateMilestone } from '../streakAnim.js';
import { playCelebrateSound } from '../sound.js';
import { t } from '../i18n.js';
import { sugerirRecetaPorEtiquetas } from '../menu.js';
import { openRecipe } from './dashboard.js';

export function renderEmergency(container) {
  header(container);
  const { user, emergencia } = getState();

  const hero = document.createElement('div');
  hero.className = 'sos-hero';
  const topPerfil = user.perfiles[0] ? PROFILES[user.perfiles[0]] : null;
  hero.innerHTML = `
    <h2>🏁 ${t(EMERGENCY_PLAN.nombre)}</h2>
    <p>${topPerfil ? t('Sabemos que lo de {perfil} preocupa. ', { perfil: esc(topPerfil.nombre.toLowerCase()) }) : ''}${t(EMERGENCY_PLAN.descripcion)}</p>`;
  container.appendChild(hero);

  // Sin plan iniciado
  if (!emergencia || !emergencia.inicio) {
    const start = document.createElement('div');
    start.className = 'card center';
    start.innerHTML = `
      <p>${t('Siete días, un paso concreto cada día. Gratis, sin letra pequeña.')}</p>
      <button class="btn accent full mt">🚀 ${t('Empezar mi plan de 7 días')}</button>`;
    start.querySelector('.btn').addEventListener('click', () => {
      setState({ emergencia: { inicio: today(), completados: [] } });
      toast(t('¡Empezamos! Día 1: {titulo}', { titulo: EMERGENCY_PLAN.dias[0].titulo }));
      renderEmergency(clear(container));
    });
    container.appendChild(start);
    return;
  }

  const completados = emergencia.completados || [];
  // El día activo es el siguiente sin completar, nunca más de uno a la vez
  // — si se salta un día, ese día se queda como "activo" hasta que se
  // complete, en vez de desbloquear de golpe todos los días que pasaron
  // en el calendario.
  const siguientePendiente = EMERGENCY_PLAN.dias.find((d) => !completados.includes(d.n))?.n ?? 8;
  const diaDesbloqueadoPorCalendario = Math.min(7, diasDesde(emergencia.inicio, today()) + 1);
  let diaDesbloqueado = Math.min(siguientePendiente, diaDesbloqueadoPorCalendario);
  // Tope real: nunca más de UN día completado por día calendario, aunque
  // el calendario ya habilite varios de corrido (ej. si no abriste la app
  // en varios días, el catch-up dejaba completar el día siguiente apenas
  // terminabas el anterior, todo en la misma sesión). Si ya completaste un
  // día hoy, ningún otro día queda activo hasta mañana.
  const yaCompletoHoy = emergencia.ultimaCompletadaFecha === today();
  if (yaCompletoHoy && !completados.includes(diaDesbloqueado)) diaDesbloqueado = 0;

  // Plan completado: cierre + CTA a la Misión
  if (completados.length >= 7) {
    const fin = document.createElement('div');
    fin.className = 'card center';
    fin.innerHTML = `
      <div style="font-size:3rem">🎉</div>
      <h2>${t('¡Diste el primer paso!')}</h2>
      <p class="mt">${t('Siete días de cambios reales, sin esperar a nadie. Si quieres sostener esto en el tiempo, la Misión 12 semanas te lleva al siguiente nivel, un cambio a la vez.')}</p>
      <button class="btn accent full mt">${t('Ver Misión 12 semanas →')}</button>`;
    fin.querySelector('.btn').addEventListener('click', () => navigate('mission'));
    container.appendChild(fin);
  }

  const prog = document.createElement('div');
  prog.className = 'card';
  prog.innerHTML = `
    <div class="spread"><h2>${t('Tu semana')}</h2><span class="tag info">${completados.length}/7</span></div>
    <div class="quiz-progress mt"><div style="width:${Math.round((completados.length / 7) * 100)}%"></div></div>`;
  container.appendChild(prog);

  const list = document.createElement('div');
  list.className = 'card';
  const items = EMERGENCY_PLAN.dias.map((d) => {
    const done = completados.includes(d.n);
    const locked = d.n > diaDesbloqueado;
    const isCurrent = d.n === diaDesbloqueado && !done;
    return {
      icon: d.emoji, title: t('Día {n}', { n: d.n }), subtitle: d.titulo,
      done, now: isCurrent, locked, nowLabel: t('Hoy'),
      onClick: () => {
        if (locked) { showVuelveManana(d); return; }
        openDia(d, done, () => renderEmergency(clear(container)));
      }
    };
  });
  // Misma curva animada que "Tu ruta de hoy" (ver curvaRepetida en
  // pathMap.js) -- pedido explícito de la usuaria de que se vea
  // exactamente igual en Plan de 7 días. "now" y "done" nunca coinciden
  // acá (isCurrent ya exige !done), así que el índice activo es directo,
  // sin el ajuste extra que sí necesita el menú del día.
  const activeIndex = items.findIndex((it) => it.now);
  // rowGap: sin los botones extra que sí tiene "Tu ruta de hoy" bajo cada
  // fila, acá el punteado apenas se notaba en algunos tramos -- más aire
  // vertical entre nodos, solo en esta vista.
  renderPathMap(list, items, { showLine: true, activeIndex: activeIndex === -1 ? undefined : activeIndex, rowGap: 40 });
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
    <div class="label wrap">${t('Ya diste tu paso de hoy — vuelve mañana después de medianoche para el Día {n}', { n: dia.n })}</div>`;
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
      <h2>${t('Día {n}: {titulo}', { n: dia.n, titulo: dia.titulo })}</h2>
      <p class="mt"><strong>${t('Objetivo:')}</strong> ${dia.objetivo}</p>
      <h3 class="mt">${t('Hoy vas a…')}</h3>
      <ul class="steps">${dia.acciones.map((a) => `<li>${a}</li>`).join('')}</ul>
      <h3 class="mt">${t('Para reflexionar')}</h3>
      <p>${dia.reflexion}</p>
      <div id="dia-receta"></div>
      <label class="muted small mt" for="dia-reflexion" style="display:block">${t('Escribe tu respuesta (mínimo 40 caracteres) para poder marcar el día como completado')}</label>
      <textarea id="dia-reflexion" maxlength="500" rows="3" placeholder="${t('Escribe lo que quieras...')}"
        class="auth-input" style="resize:vertical">${esc(reflexionGuardada)}</textarea>`);
    // Receta real del catálogo que acompaña el tema del día (ej. día 4 =
    // snack de emergencia sugiere un snack saludable de verdad) -- nunca
    // bloquea el día si no hay ninguna disponible para el perfil/exclusiones.
    const receta = sugerirRecetaPorEtiquetas(dia.recetaComida || null, dia.recetaEtiquetas || []);
    if (receta) {
      const recetaWrap = modal.querySelector('#dia-receta');
      recetaWrap.innerHTML = `
        <div class="card mt" style="background:var(--modal-bg)">
          <div class="row" style="gap:10px;align-items:center">
            <span style="font-size:1.6rem">${receta.emoji}</span>
            <div style="flex:1">
              <div class="small muted">${t('Receta sugerida para hoy')}</div>
              <strong>${esc(t(receta.nombre))}</strong>
            </div>
          </div>
          <button type="button" class="btn ghost full mt" id="dia-ver-receta">${t('Ver receta')}</button>
        </div>`;
      recetaWrap.querySelector('#dia-ver-receta').addEventListener('click', () => openRecipe(receta));
    }
    const textarea = modal.querySelector('#dia-reflexion');
    const btn = document.createElement('button');
    btn.className = done ? 'btn ghost full mt' : 'btn full mt';
    btn.textContent = done ? t('↩️ Desmarcar día') : t('✅ Marcar día como completado');
    if (!done) {
      btn.disabled = !esTextoReal(textarea.value);
      textarea.addEventListener('input', () => { btn.disabled = !esTextoReal(textarea.value); });
    }
    btn.addEventListener('click', () => {
      guardarReflexionDia(dia.n, textarea.value);
      const { emergencia } = getState();
      const completados = new Set(emergencia.completados || []);
      const completando = !done;
      done ? completados.delete(dia.n) : completados.add(dia.n);
      setState({
        emergencia: {
          ...emergencia, completados: [...completados],
          ultimaCompletadaFecha: completando ? today() : emergencia.ultimaCompletadaFecha
        }
      });
      const nuevos = checkAchievements();
      close();
      if (completando) {
        const bono = nuevos.includes('plan_mitad') ? GEMAS_BONUS_HITO : 0;
        otorgarGemas(GEMAS_POR_DIA + bono);
        sumarEnergiaRuta(2, 1); // equivalente a "completar microacción"
        playCelebrateSound();
        const subt = bono
          ? `${dia.titulo} · +${GEMAS_POR_DIA + bono} 💎 (¡bono de mitad de camino!)`
          : `${dia.titulo} · +${GEMAS_POR_DIA} 💎`;
        celebrateMilestone(t('¡Día {n} completado!', { n: dia.n }), subt);
      }
      if (nuevos.includes('plan7_completo')) {
        toast(t('🎉 ¡Completaste tu plan de 7 días!'));
        const { emergencia: e2 } = getState();
        if (!e2.testimonioPlanPreguntado) setTimeout(() => abrirInvitacionTestimonioPlan(), 500);
      }
      if (onChange) onChange();
    });
    modal.appendChild(btn);
  });
}


// Invitación cálida a compartir las reflexiones de la semana como
// testimonio — se pregunta UNA sola vez, justo al completar el día 7,
// el momento de mayor logro real, no en cada día.
function abrirInvitacionTestimonioPlan() {
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2rem">💛</div>
      <h2>${t('Completaste tus 7 días')}</h2>
      <p class="small mt">${t('Nos encantaría compartir lo que escribiste en tus reflexiones de esta semana — con tu nombre o de forma anónima, como prefieras — para inspirar a alguien que está empezando justo como tú hace una semana. Es completamente tu decisión, y no pasa nada si prefieres que quede solo entre nosotros.')}</p>
      <div class="row mt" style="gap:10px">
        <button class="btn ghost sm" id="tp-no">${t('Prefiero que quede privado')}</button>
        <button class="btn sm" id="tp-si" style="flex:1">${t('Sí, compartan mi historia 💛')}</button>
      </div>`);
    modal.querySelector('#tp-no').addEventListener('click', () => {
      responderInvitacionTestimonioPlan(false);
      close();
    });
    modal.querySelector('#tp-si').addEventListener('click', () => {
      responderInvitacionTestimonioPlan(true);
      close();
      toast(t('Gracias por confiar en nosotros 💛'));
    });
  });
}

function clear(container) { container.innerHTML = ''; return container; }
