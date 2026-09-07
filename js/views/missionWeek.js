// Panorama de una semana de la Misión 12 semanas -- pantalla propia (no
// modal), pedida explícitamente por la usuaria: al tocar una semana debe
// verse el objetivo completo, el desglose día por día (qué hacer cada uno
// de los 7 días) y la reflexión final, no solo una tarjeta plana con el
// título. Mismo estilo de "pantalla con header + Volver" que weekMenu.js
// (no el estilo de pantalla completa del quiz/SOS, la usuaria pidió dejar
// el Plan de 7 días y la Misión con estilos visuales distintos).
import { getState, setState, checkAchievements, today, esc, guardarReflexionSemana, responderInvitacionTestimonioMision, otorgarGemas, GEMAS_POR_DIA, GEMAS_BONUS_HITO, sumarEnergiaRuta, esTextoReal } from '../store.js';
import { header, navigate, toast, openModal } from '../app.js';
import { celebrateMilestone } from '../streakAnim.js';
import { playCelebrateSound } from '../sound.js';
import { t, getIdioma } from '../i18n.js';
import { sugerirRecetaPorEtiquetas } from '../menu.js';
import { openRecipe } from './dashboard.js';
import { barChart } from '../charts.js';

// Pistas para sugerir una receta real del catálogo por tema de semana --
// mismo espíritu que EMERGENCY_PLAN.dias[].recetaEtiquetas, pero el
// contenido de las semanas vive en Supabase (mission_weeks) así que las
// pistas de receta se mantienen acá, en el cliente, por número de semana.
const RECETA_HINTS_MISION = {
  1: { etiquetas: ['hidratante'] },
  2: { comida: 'desayuno', etiquetas: ['alto_proteina'] },
  3: { etiquetas: ['hidratante'] },
  4: { comida: 'almuerzo', etiquetas: ['plato_modelo'] },
  5: { etiquetas: ['bajo_ig'] },
  6: { comida: 'desayuno', etiquetas: ['rapido'] },
  7: { comida: 'cena', etiquetas: ['mediterraneo', 'ligero'] },
  8: { etiquetas: ['fermentado', 'alto_fibra', 'fibra_soluble', 'microbiota'] },
  9: { comida: 'cena', etiquetas: ['ligero'] },
  10: { comida: 'media_tarde', etiquetas: ['antojo_dulce_saludable', 'antojo_salado_saludable', 'snack_antiansiedad'] },
  11: { etiquetas: ['suave', 'hidratante'] },
  12: { etiquetas: ['mediterraneo'] }
};
// Abreviaturas de día sin pasar por t() -- "mar" ya es clave de traducción
// para "marzo" en otra parte del diccionario, y reusar el mismo texto
// fuente para "martes" pisaría esa traducción. Se elige el arreglo según
// el idioma activo en el momento de pintar, no al cargar el módulo.
const DIAS_CORTOS_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_CORTOS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function diasCortos() {
  return getIdioma() === 'en' ? DIAS_CORTOS_EN : DIAS_CORTOS_ES;
}

// Gráfica real de "días con hábitos cumplidos" durante el rango de
// calendario de esta semana (mision.inicio + 7*(n-1) días) -- solo
// aparece si hay al menos 2 días de historial real en ese rango, nunca
// se inventa ni se rellena con ceros.
function progresoSemanaHtml(weekN) {
  const { mision, historialDiario, habitos } = getState();
  if (!mision?.inicio) return '';
  const inicio = new Date(mision.inicio + 'T00:00:00');
  inicio.setDate(inicio.getDate() + (weekN - 1) * 7);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);
  const t0 = today();
  const hoyEnRango = t0 >= inicio.toISOString().slice(0, 10) && t0 <= fin.toISOString().slice(0, 10);
  const dias = [...historialDiario];
  if (hoyEnRango && habitos.fecha === t0) {
    dias.push({ fecha: t0, habitosCompletados: Object.values(habitos.checks || {}).filter(Boolean).length, habitosTotal: 5 });
  }
  const enRango = dias
    .filter((d) => d.fecha >= inicio.toISOString().slice(0, 10) && d.fecha <= fin.toISOString().slice(0, 10))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (enRango.length < 2) return '';
  const dc = diasCortos();
  const items = enRango.map((d) => ({
    label: dc[new Date(d.fecha + 'T00:00:00').getDay()],
    value: Math.round((d.habitosCompletados / (d.habitosTotal || 5)) * 100)
  }));
  return `<div class="card mt">
    <h3>${t('Tus hábitos esta semana')}</h3>
    <div class="mt">${barChart(items, { color: 'var(--primary)', suffix: '%' })}</div>
  </div>`;
}

export function renderMissionWeek(container, { week, canComplete = false, done = false } = {}) {
  header(container);

  if (!week) { navigate('mission'); return; }

  const back = document.createElement('button');
  back.className = 'link-btn small';
  back.textContent = t('← Volver a la Misión');
  back.addEventListener('click', () => navigate('mission'));
  container.appendChild(back);

  const { mision } = getState();
  const reflexionGuardada = (mision?.reflexiones || {})[week.n] || '';
  const dias = week.dias || [];

  const hero = document.createElement('div');
  hero.className = 'card center';
  hero.innerHTML = `
    <div style="font-size:2.4rem">${week.emoji}</div>
    <h2 class="mt">${t('Semana {n}: {titulo}', { n: week.n, titulo: week.titulo })}</h2>
    <p class="mt"><strong>${t('Objetivo:')}</strong> ${week.objetivo}</p>`;
  container.appendChild(hero);

  if (dias.length) {
    const diasCard = document.createElement('div');
    diasCard.className = 'card';
    diasCard.innerHTML = `
      <h3>${t('Tu semana, día a día')}</h3>
      <ul class="steps mt">
        ${dias.map((d) => `<li><strong>${t('Día {n}: {titulo}', { n: d.n, titulo: d.titulo })}</strong><br><span class="small muted">${d.accion}</span></li>`).join('')}
      </ul>`;
    container.appendChild(diasCard);
  } else if ((week.acciones || []).length) {
    const accionesCard = document.createElement('div');
    accionesCard.className = 'card';
    accionesCard.innerHTML = `
      <h3>${t('Acciones de la semana')}</h3>
      <ul class="steps mt">${week.acciones.map((a) => `<li>${a}</li>`).join('')}</ul>`;
    container.appendChild(accionesCard);
  }

  // Receta real del catálogo para el tema de esta semana (nunca inventada,
  // respeta exclusiones y semáforo del usuario como el resto del menú).
  const hint = RECETA_HINTS_MISION[week.n];
  const receta = hint ? sugerirRecetaPorEtiquetas(hint.comida || null, hint.etiquetas || []) : null;
  if (receta) {
    const recetaCard = document.createElement('div');
    recetaCard.className = 'card';
    recetaCard.innerHTML = `
      <div class="row" style="gap:10px;align-items:center">
        <span style="font-size:1.6rem">${receta.emoji}</span>
        <div style="flex:1">
          <div class="small muted">${t('Receta sugerida para esta semana')}</div>
          <strong>${esc(t(receta.nombre))}</strong>
        </div>
      </div>
      <button type="button" class="btn ghost full mt" id="semana-ver-receta">${t('Ver receta')}</button>`;
    recetaCard.querySelector('#semana-ver-receta').addEventListener('click', () => openRecipe(receta));
    container.appendChild(recetaCard);
  }

  // Progreso real de hábitos durante el rango de calendario de esta
  // semana -- solo aparece si ya hay historial en ese rango.
  const progresoHtml = progresoSemanaHtml(week.n);
  if (progresoHtml) container.insertAdjacentHTML('beforeend', progresoHtml);

  const reflexionCard = document.createElement('div');
  reflexionCard.className = 'card';
  reflexionCard.innerHTML = `
    <h3>${t('Para reflexionar')}</h3>
    <p>${week.reflexion}</p>`;
  if (canComplete) {
    reflexionCard.insertAdjacentHTML('beforeend', `
      <label class="muted small mt" for="semana-reflexion" style="display:block">${t('Escribe tu respuesta (mínimo 40 caracteres) para poder marcar la semana como completada')}</label>
      <textarea id="semana-reflexion" maxlength="500" rows="3" placeholder="${t('Escribe lo que quieras...')}"
        class="auth-input" style="resize:vertical">${esc(reflexionGuardada)}</textarea>`);
    const btn = document.createElement('button');
    btn.className = done ? 'btn ghost full mt' : 'btn full mt';
    btn.textContent = done ? t('↩️ Desmarcar semana') : t('✅ Marcar semana como completada');
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
        const esHito = nuevos.includes('mision_mes1') || nuevos.includes('mision_mes2') || nuevos.includes('mision12_completo');
        const gemasSemana = GEMAS_POR_DIA * 3 + (esHito ? GEMAS_BONUS_HITO : 0);
        otorgarGemas(gemasSemana);
        sumarEnergiaRuta(8, 5); // "Completar misión semanal"
        playCelebrateSound();
        const subt = esHito
          ? `${week.titulo} · +${gemasSemana} 💎 (¡bono de hito!)`
          : `${week.titulo} · +${gemasSemana} 💎`;
        celebrateMilestone(t('¡Semana {n} completada!', { n: week.n }), subt);
      }
      if (nuevos.includes('mision12_completo')) {
        toast(t('🏆 ¡Completaste las 12 semanas de la Misión!'));
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
      <h2>${t('Completaste tu Misión')}</h2>
      <p class="small mt">${t('Nos encantaría compartir lo que escribiste en tus reflexiones de estas 12 semanas — con tu nombre o de forma anónima, como prefieras — para inspirar a alguien que está empezando su propia misión. Es completamente tu decisión, y no pasa nada si prefieres que quede solo entre nosotros.')}</p>
      <div class="row mt" style="gap:10px">
        <button class="btn ghost sm" id="tm-no">${t('Prefiero que quede privado')}</button>
        <button class="btn sm" id="tm-si" style="flex:1">${t('Sí, compartan mi historia 💛')}</button>
      </div>`);
    modal.querySelector('#tm-no').addEventListener('click', () => {
      responderInvitacionTestimonioMision(false);
      close();
    });
    modal.querySelector('#tm-si').addEventListener('click', () => {
      responderInvitacionTestimonioMision(true);
      close();
      toast(t('Gracias por confiar en nosotros 💛'));
    });
  });
}
