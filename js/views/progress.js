// Mi progreso: rachas, logros, gráficas, historial de antojos, diario de
// síntomas, y los accesos a Plan de 7 días/Misión/Aprender (movidos aquí
// desde el dashboard diario — ver dashboard.js).
import { getState, logSintoma, sintomaPattern, esc, today, getWaterGoal, isPremium, sanaApertura } from '../store.js';
import { SYMPTOM_TYPES, SYMPTOM_CAUSES } from '../data/profiles.js';
import { MISSION } from '../data/mission.js';
import { EMERGENCY_PLAN } from '../data/emergencyPlan.js';
import { header, openModal, toast, navigate, susanaName, SHARE_ICON } from '../app.js';
import { t, getIdioma } from '../i18n.js';
import { barChart, lineChart } from '../charts.js';
import { abrirCompartirPlantillas } from '../shareUI.js';

let rangoActivo = 'semana';

// Nombres cortos de día/mes vía Intl en vez de arreglos fijos en español --
// así siguen el idioma de la app sin mantener una traducción propia.
function diaCorto(fechaYYYYMMDD) {
  return new Date(fechaYYYYMMDD + 'T00:00:00').toLocaleDateString(getIdioma() === 'en' ? 'en-US' : 'es', { weekday: 'short' });
}
function mesCorto(fechaYYYYMM) {
  return new Date(fechaYYYYMM + '-01T00:00:00').toLocaleDateString(getIdioma() === 'en' ? 'en-US' : 'es', { month: 'short' });
}

export function renderProgress(container) {
  header(container);
  const { antojos, sintomas, checkins, user } = getState();

  // La racha ya no se repite aquí -- vive solo en el modal "Mis Rachas"
  // (rachaDetailHtml en app.js), al que se llega tocando la llamita 🔥
  // del header, visible también en esta misma pantalla.

  // --- Plan de 7 días (gratis, respuesta inmediata) ---
  // Antes esta tarjeta desaparecía del todo al llegar a 7/7 -- y como es
  // un punto de entrada importante a la vista 'emergency', completar el
  // plan lo dejaba inaccesible para siempre, aunque la vista sí tiene un
  // cierre armado para ese estado. Se queda, con su propia variante de
  // completado.
  const planesGrid = document.createElement('div');
  planesGrid.className = 'progress-plans-grid';
  container.appendChild(planesGrid);

  const { emergencia } = getState();
  const diasCompletados7 = (emergencia?.completados || []).length;
  const emergCard = document.createElement('div');
  emergCard.className = 'card';
  if (diasCompletados7 >= 7) {
    emergCard.innerHTML = `
      <div class="spread" style="align-items:flex-start"><h3>${t('🏁 Plan de 7 días')}</h3><span class="tag verde">${t('Completado')}</span></div>
      <p class="small">${t('Diste el primer paso — revisa tu semana cuando quieras.')}</p>
      <button class="link-btn small">${t('Ver mi plan →')}</button>`;
  } else if (emergencia?.inicio) {
    emergCard.innerHTML = `
      <div class="spread" style="align-items:flex-start"><h3>${t('🏁 Plan de 7 días')}</h3><span class="tag verde">${diasCompletados7}/7</span></div>
      <div class="quiz-progress mt" style="margin-bottom:6px"><div style="width:${Math.round((diasCompletados7 / 7) * 100)}%"></div></div>
      <button class="link-btn small">${t('Continuar mi plan →')}</button>`;
  } else {
    emergCard.innerHTML = `
      <div class="spread" style="align-items:flex-start"><h3>${t('🏁 Plan de 7 días')}</h3><span class="tag info">${t('Gratis')}</span></div>
      <p class="small">${EMERGENCY_PLAN.descripcion}</p>
      <button class="link-btn small">${t('Empezar hoy mismo →')}</button>`;
  }
  emergCard.querySelector('.link-btn').addEventListener('click', () => navigate('emergency'));
  planesGrid.appendChild(emergCard);

  // --- Misión 12 semanas ---
  const { mision } = getState();
  const misionCard = document.createElement('div');
  misionCard.className = 'card';
  if (mision && mision.inicio) {
    const done = (mision.completadas || []).length;
    const activa = isPremium();
    misionCard.innerHTML = `
      <div class="spread" style="align-items:flex-start"><h3>${t('🎯 Misión 12 semanas')}</h3><span class="tag ${activa ? 'verde' : 'rojo'}">${activa ? `${done}/12` : t('Pausada')}</span></div>
      <div class="quiz-progress mt" style="margin-bottom:6px"><div style="width:${Math.round((done / 12) * 100)}%"></div></div>
      <button class="link-btn small">${activa ? t('Continuar mi misión →') : t('Renovar Premium para continuar →')}</button>`;
  } else {
    misionCard.innerHTML = `
      <div class="spread" style="align-items:flex-start"><h3>${t('🎯 Misión 12 semanas')}</h3>${isPremium() ? '' : `<span class="tag info">${t('Premium')}</span>`}</div>
      <p class="small">${MISSION.descripcion}</p>
      <button class="link-btn small">${isPremium() ? t('Empezar mi misión →') : t('Conocer la misión →')}</button>`;
  }
  misionCard.querySelector('.link-btn').addEventListener('click', () => navigate('mission'));
  planesGrid.appendChild(misionCard);

  // --- Aprende: antes su propio tab en el menú inferior, ese lugar ahora
  // lo ocupa SuSana (el "Coach", ver index.html) -- se reubica aquí como
  // un acceso compacto, no una tarjeta grande, porque no tiene un estado
  // de progreso propio que mostrar como las de arriba. ---
  const aprendeCard = document.createElement('div');
  aprendeCard.className = 'card';
  aprendeCard.innerHTML = `<button type="button" class="setting-row" style="padding:2px 0">
    <span class="setting-row-icon">📚</span>
    <span class="setting-row-label">${t('Aprende')}</span>
    <span class="setting-row-chevron">›</span>
  </button>`;
  aprendeCard.querySelector('.setting-row').addEventListener('click', () => navigate('learn'));
  container.appendChild(aprendeCard);

  // --- Gráficas de progreso ---
  const chartsCard = document.createElement('div');
  chartsCard.className = 'card';
  chartsCard.innerHTML = `
    <div class="spread"><h2>${t('📊 Tu progreso')}</h2></div>
    <div class="chips mt" id="rango-tabs"></div>
    <p class="small mt" style="font-weight:600">${t('Hábitos cumplidos')}</p>
    <div id="chart-habitos" class="mt"></div>
    <p class="small mt" style="font-weight:600">${t('Meta de agua alcanzada')}</p>
    <div id="chart-agua" class="mt"></div>`;
  const tabs = chartsCard.querySelector('#rango-tabs');
  for (const r of [['dia', t('Día')], ['semana', t('Semana')], ['mes', t('Mes')]]) {
    const b = document.createElement('button');
    b.className = 'chip' + (rangoActivo === r[0] ? ' selected' : '');
    b.textContent = r[1];
    b.addEventListener('click', () => { rangoActivo = r[0]; renderProgress(clear(container)); });
    tabs.appendChild(b);
  }
  container.appendChild(chartsCard);
  pintarGraficasProgreso(chartsCard);

  // --- Proyección de constancia ---
  const proyeccion = document.createElement('div');
  proyeccion.className = 'card';
  proyeccion.innerHTML = buildProjectionHtml();
  container.appendChild(proyeccion);

  // --- Peso (opcional) ---
  if (user.trackearPeso) {
    const { pesos } = getState();
    const pesoCard = document.createElement('div');
    pesoCard.className = 'card';
    if (pesos.length >= 2) {
      const items = pesos.slice(-10).map((p) => ({ value: p.kg, label: `${p.fecha.slice(8, 10)}/${p.fecha.slice(5, 7)}` }));
      const primero = pesos[0].kg;
      const ultimo = pesos[pesos.length - 1].kg;
      const diff = ultimo - primero;
      pesoCard.innerHTML = `<h2>${t('⚖️ Tendencia de peso')}</h2>
        <div class="mt">${lineChart(items, { color: 'var(--secondary)' })}</div>
        <p class="small muted mt">${t('Registros: {n}. Último: {kg} kg ({fecha}). Interpreta estos cambios con tu profesional de salud, no solo con la cifra.', { n: pesos.length, kg: ultimo, fecha: pesos[pesos.length - 1].fecha })}</p>
        <button type="button" class="btn ghost full mt" id="peso-compartir">${SHARE_ICON}${t('Compartir mi progreso')}</button>`;
      pesoCard.querySelector('#peso-compartir').addEventListener('click', () => {
        abrirCompartirPlantillas({
          tipo: 'peso',
          titulo: t('Mi progreso en NutriRuta'),
          subtitulo: t('Desde {fecha}', { fecha: pesos[0].fecha }),
          // Con signo siempre visible (+/-) -- una bajada Y una subida son
          // igual de válidas de compartir (ej. alguien en superávit
          // buscando subir de peso con salud), nunca se asume una sola
          // dirección "buena".
          valorGrande: `${diff > 0 ? '+' : diff < 0 ? '-' : ''}${Math.abs(diff).toFixed(1)} kg`,
          valorEtiqueta: t('{n} registros', { n: pesos.length }),
          emoji: '⚖️'
        });
      });
    } else if (pesos.length === 1) {
      pesoCard.innerHTML = `<h2>${t('⚖️ Tendencia de peso')}</h2>
        <p class="small mt">${t('Tienes un registro. Cuando agregues otro en Ajustes, verás aquí tu tendencia.')}</p>`;
    } else {
      pesoCard.innerHTML = `<h2>${t('⚖️ Tendencia de peso')}</h2>
        <p class="small mt">${t('Actívalo en Ajustes y registra tu peso cuando quieras verlo aquí.')}</p>`;
    }
    container.appendChild(pesoCard);
  }

  // --- Impacto ---
  const impact = document.createElement('div');
  impact.className = 'card';
  impact.innerHTML = `
    <h2>${t('🌱 Tu impacto')}</h2>
    <p class="small">${t('Si mantienes estos hábitos, ayudas a tu glucosa, tu hígado y tu colesterol. Los cambios sostenidos por 12 semanas pueden reflejarse en tus próximos exámenes. Recuerda revisarlos siempre con tu profesional de salud.')}</p>`;
  container.appendChild(impact);

  // Logros: ya no vive aquí -- tiene su propio modal desde el botón
  // "Logros" del carrusel en Hoy (ver abrirModalLogros en dashboard.js),
  // pedido explícito de la usuaria para no repetir la misma tarjeta dos
  // veces en la app.

  // --- Testimonios compartidos (si el usuario autorizó alguno) ---
  const compartidos = checkins.filter((c) => c.compartir === true);
  if (compartidos.length) {
    const testi = document.createElement('div');
    testi.className = 'card';
    testi.innerHTML = `<div class="spread"><h2>${t('🎙️ Tus testimonios')}</h2></div>
      <p class="small">${t('{n} respuesta{s} que autorizaste compartir.', { n: compartidos.length, s: compartidos.length === 1 ? '' : 's' })}</p>
      <button class="link-btn small mt">${t('Ver tarjetas →')}</button>`;
    testi.querySelector('.link-btn').addEventListener('click', () => navigate('testimonials'));
    container.appendChild(testi);
  }

  // Antojos
  const sos = document.createElement('div');
  sos.className = 'card';
  const superados = antojos.filter((a) => a.resultado === 'alternativa').length;
  sos.innerHTML = `<h2>${t('💚 Tus antojos')}</h2>
    <p class="small">${antojos.length ? t('Registrados: {n} · Superados con alternativa: <strong>{sup}</strong>', { n: antojos.length, sup: superados }) : t('Aún no registras antojos. Cuando llegue uno, usa el botón SOS.')}</p>`;
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
      ? `<p class="small mt" style="border-left:4px solid var(--accent);padding-left:10px">${t('💡 <strong>Hemos notado</strong> que <strong>{valor}</strong> aparece seguido en tus registros. Puede ser tu disparador.', { valor: esc(patron.valor) })}</p>`
      : `<p class="small mt" style="border-left:4px solid var(--accent);padding-left:10px">${t('💡 <strong>Hemos notado</strong> que tus síntomas suelen aparecer en la <strong>{valor}</strong>.', { valor: esc(patron.valor) })}</p>`;
  }
  diario.innerHTML = `
    <div class="spread"><h2>${t('📋 Diario de síntomas')}</h2></div>
    <p class="small">${sintomas.length ? t('Registrados: {n}', { n: sintomas.length }) : t('Registra gases, hinchazón, estreñimiento, diarrea o migraña, y con el tiempo te ayudamos a ver qué los dispara.')}</p>
    ${patronHtml}
    <button class="btn quiet sm mt" id="btn-log-sintoma">${t('+ Registrar síntoma')}</button>`;
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

// ---------- Datos combinados: historial archivado + el día de hoy en vivo ----------
function diasCombinados() {
  const { historialDiario, habitos, agua } = getState();
  const t = today();
  const checksHoy = habitos.fecha === t ? habitos.checks || {} : {};
  const hoy = {
    fecha: t,
    habitosCompletados: Object.values(checksHoy).filter(Boolean).length,
    habitosTotal: 5,
    vasosAgua: agua.fecha === t ? agua.vasos : 0,
    metaAgua: getWaterGoal()
  };
  const historial = historialDiario.filter((h) => h.fecha !== t);
  return [...historial, hoy].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function pintarGraficasProgreso(chartsCard) {
  const dias = diasCombinados();
  const habitosEl = chartsCard.querySelector('#chart-habitos');
  const aguaEl = chartsCard.querySelector('#chart-agua');
  if (!dias.length) {
    habitosEl.innerHTML = `<p class="small muted">${t('Aún no hay datos suficientes. Vuelve mañana.')}</p>`;
    aguaEl.innerHTML = '';
    return;
  }

  let items;
  if (rangoActivo === 'dia') {
    const ultimos = dias.slice(-7);
    items = ultimos.map((d) => ({
      label: diaCorto(d.fecha),
      habitosPct: (d.habitosCompletados / (d.habitosTotal || 5)) * 100,
      aguaPct: d.metaAgua ? (d.vasosAgua / d.metaAgua) * 100 : 0
    }));
  } else if (rangoActivo === 'semana') {
    items = agruparPorSemana(dias).slice(-6);
  } else {
    items = agruparPorMes(dias).slice(-6);
  }

  if (items.length < 2) {
    habitosEl.innerHTML = `<p class="small muted">${t('Necesitas un par de días más de historial para ver esta vista.')}</p>`;
    aguaEl.innerHTML = '';
    return;
  }

  habitosEl.innerHTML = barChart(items.map((i) => ({ label: i.label, value: Math.round(i.habitosPct) })), { color: 'var(--primary)', suffix: '%' });
  aguaEl.innerHTML = barChart(items.map((i) => ({ label: i.label, value: Math.round(i.aguaPct) })), { color: 'var(--secondary)', suffix: '%' });
}

function agruparPorSemana(dias) {
  const grupos = {};
  for (const d of dias) {
    const dt = new Date(d.fecha + 'T00:00:00');
    const lunes = new Date(dt);
    lunes.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); // retrocede al lunes
    const key = lunes.toISOString().slice(0, 10);
    if (!grupos[key]) grupos[key] = { fechas: [], habitosPct: 0, aguaPct: 0, label: `${lunes.getDate()}/${lunes.getMonth() + 1}` };
    const g = grupos[key];
    g.fechas.push(d);
    g.habitosPct += (d.habitosCompletados / (d.habitosTotal || 5)) * 100;
    g.aguaPct += d.metaAgua ? (d.vasosAgua / d.metaAgua) * 100 : 0;
  }
  return Object.values(grupos)
    .sort((a, b) => a.fechas[0].fecha.localeCompare(b.fechas[0].fecha))
    .map((g) => ({ label: g.label, habitosPct: g.habitosPct / g.fechas.length, aguaPct: g.aguaPct / g.fechas.length }));
}

function agruparPorMes(dias) {
  const grupos = {};
  for (const d of dias) {
    const key = d.fecha.slice(0, 7);
    if (!grupos[key]) grupos[key] = { fechas: [], habitosPct: 0, aguaPct: 0, label: mesCorto(key) };
    const g = grupos[key];
    g.fechas.push(d);
    g.habitosPct += (d.habitosCompletados / (d.habitosTotal || 5)) * 100;
    g.aguaPct += d.metaAgua ? (d.vasosAgua / d.metaAgua) * 100 : 0;
  }
  return Object.entries(grupos)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, g]) => ({ label: g.label, habitosPct: g.habitosPct / g.fechas.length, aguaPct: g.aguaPct / g.fechas.length }));
}

// ---------- Proyección de constancia (comportamiento, no resultado de salud) ----------
function buildProjectionHtml() {
  const dias = diasCombinados().slice(-14);
  if (dias.length < 3) {
    return `<h2>${t('🔭 Si mantienes tu ritmo')}</h2>
      <p class="small mt">${t('Registra unos días más de hábitos para que podamos mostrarte una proyección de tu constancia.')}</p>`;
  }
  const tasa = dias.reduce((acc, d) => acc + d.habitosCompletados / (d.habitosTotal || 5), 0) / dias.length;
  const semanas = [1, 2, 3, 4].map((n) => ({
    label: t('Sem {n}', { n }),
    value: Math.round(Math.min(7, tasa * 7) * n)
  }));
  return `<h2>${t('🔭 Si mantienes tu ritmo')}</h2>
    <p class="small mt">${t('En tus últimos {dias} días registrados cumples en promedio el <strong>{pct}%</strong> de tus hábitos diarios. Así se vería tu constancia acumulada si mantienes ese ritmo:', { dias: dias.length, pct: Math.round(tasa * 100) })}</p>
    <div class="mt">${barChart(semanas, { color: 'var(--primary)', suffix: 'd' })}</div>
    <p class="small muted mt">${t('Esto es una proyección de tu constancia con la app, no un pronóstico de salud. Tus resultados dependen de muchos factores; revísalos siempre con tu profesional de salud.')}</p>`;
}

function openSintomaModal(onSaved) {
  let tipo = null;
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <h2>${t('📋 Registrar síntoma')}</h2>
      <p class="small mt">${t('¿Qué sentiste?')}</p>
      <div class="chips mt" id="sintoma-chips"></div>
      <p class="small mt" id="sintoma-causa" style="border-left:4px solid var(--secondary);padding-left:10px;display:none"></p>
      <label class="muted small mt" for="sintoma-disparador" style="display:block">${t('¿Sospechas qué lo causó? (opcional)')}</label>
      <input id="sintoma-disparador" type="text" maxlength="60" placeholder="${t('Ej: cebolla, lácteos, estrés…')}" class="auth-input">
      <button class="btn full mt" id="sintoma-guardar" disabled>${t('Guardar')}</button>`);
    const chipWrap = modal.querySelector('#sintoma-chips');
    const guardarBtn = modal.querySelector('#sintoma-guardar');
    const causaEl = modal.querySelector('#sintoma-causa');
    for (const t of SYMPTOM_TYPES) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = `${t.emoji} ${t.nombre}`;
      b.addEventListener('click', () => {
        tipo = t.id;
        chipWrap.querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c === b));
        guardarBtn.disabled = false;
        const causa = SYMPTOM_CAUSES[tipo];
        causaEl.style.display = causa ? 'block' : 'none';
        causaEl.textContent = causa ? `💡 ${causa}` : '';
      });
      chipWrap.appendChild(b);
    }
    guardarBtn.addEventListener('click', () => {
      if (!tipo) return;
      const disparador = modal.querySelector('#sintoma-disparador').value;
      logSintoma(tipo, disparador);
      close();
      toast(t('Registrado. Cada dato te ayuda a entender tu cuerpo 🌱'));
      if (onSaved) onSaved();
    });
  });
}

function labelTipo(tipo) {
  return { dulce: t('Antojo de dulce'), salado: t('Antojo salado'), alcohol: t('Alcohol'), picoteo: t('Picoteo nocturno'), no_se: t('Ansiedad general') }[tipo] || tipo;
}

function labelTipoSintoma(t) {
  const found = SYMPTOM_TYPES.find((s) => s.id === t);
  return found ? `${found.emoji} ${found.nombre}` : t;
}
