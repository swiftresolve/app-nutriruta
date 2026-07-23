// Mi progreso: rachas, logros, gráficas, historial de antojos y diario de síntomas.
import { getState, ACHIEVEMENTS, logSintoma, sintomaPattern, esc, today, getWaterGoal, MAX_ESCUDOS } from '../store.js';
import { SYMPTOM_TYPES, SYMPTOM_CAUSES } from '../data/profiles.js';
import { header, openModal, toast, navigate } from '../app.js';
import { barChart, lineChart } from '../charts.js';

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

let rangoActivo = 'semana';

// Etapa visual de constancia: usa los mismos umbrales que ya validan los
// logros racha_3/racha_7/racha_30 (no se inventa un número nuevo de
// "hábito consolidado" — esa cifra fija no tiene respaldo científico sólido,
// ver memoria "solo info comprobada").
function growthStage(n) {
  if (n >= 30) return { emoji: '🌸', label: 'Floreciendo' };
  if (n >= 7) return { emoji: '🌿', label: 'Creciendo fuerte' };
  if (n >= 3) return { emoji: '🌱', label: 'Primeros brotes' };
  return { emoji: '🌰', label: 'Sembrando' };
}

export function renderProgress(container) {
  header(container);
  const { racha, diasCumplidos, logros, antojos, sintomas, checkins, user, escudos } = getState();

  // Racha
  const etapa = growthStage(racha.actual);
  const streak = document.createElement('div');
  streak.className = 'card streak-hero';
  streak.innerHTML = `
    <div class="num">${racha.actual} <span class="streak-flame ${racha.actual > 0 ? 'lit' : 'out'}">🔥</span></div>
    <p><strong>días seguidos</strong> cumpliendo tus hábitos</p>
    <p class="small mt">${etapa.emoji} <strong>${etapa.label}</strong> — tu constancia crece con cada día.</p>
    <p class="small muted mt">Mejor racha: ${racha.mejor} días · Total de días cumplidos: ${diasCumplidos.length}</p>
    <p class="small muted mt">🛡️ Escudos: ${escudos}/${MAX_ESCUDOS} — protegen tu racha si fallas un solo día. Se gana 1 cada 7 días de racha.</p>`;
  container.appendChild(streak);

  // --- Gráficas de progreso ---
  const chartsCard = document.createElement('div');
  chartsCard.className = 'card';
  chartsCard.innerHTML = `
    <div class="spread"><h2>📊 Tu progreso</h2></div>
    <div class="chips mt" id="rango-tabs"></div>
    <p class="small mt" style="font-weight:600">Hábitos cumplidos</p>
    <div id="chart-habitos" class="mt"></div>
    <p class="small mt" style="font-weight:600">Meta de agua alcanzada</p>
    <div id="chart-agua" class="mt"></div>`;
  const tabs = chartsCard.querySelector('#rango-tabs');
  for (const r of [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']]) {
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
      pesoCard.innerHTML = `<h2>⚖️ Tendencia de peso</h2>
        <div class="mt">${lineChart(items, { color: 'var(--secondary)' })}</div>
        <p class="small muted mt">Registros: ${pesos.length}. Último: ${pesos[pesos.length - 1].kg} kg (${pesos[pesos.length - 1].fecha}).
        Interpreta estos cambios con tu profesional de salud, no solo con la cifra.</p>`;
    } else if (pesos.length === 1) {
      pesoCard.innerHTML = `<h2>⚖️ Tendencia de peso</h2>
        <p class="small mt">Tienes un registro. Cuando agregues otro en Ajustes, verás aquí tu tendencia.</p>`;
    } else {
      pesoCard.innerHTML = `<h2>⚖️ Tendencia de peso</h2>
        <p class="small mt">Actívalo en Ajustes y registra tu peso cuando quieras verlo aquí.</p>`;
    }
    container.appendChild(pesoCard);
  }

  // --- Impacto ---
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

  // --- Testimonios compartidos (si el usuario autorizó alguno) ---
  const compartidos = checkins.filter((c) => c.compartir === true);
  if (compartidos.length) {
    const testi = document.createElement('div');
    testi.className = 'card';
    testi.innerHTML = `<div class="spread"><h2>🎙️ Tus testimonios</h2></div>
      <p class="small">${compartidos.length} respuesta${compartidos.length > 1 ? 's' : ''} que autorizaste compartir.</p>
      <button class="link-btn small mt">Ver tarjetas →</button>`;
    testi.querySelector('.link-btn').addEventListener('click', () => navigate('testimonials'));
    container.appendChild(testi);
  }

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

  // Diario de síntomas (detector de disparadores)
  const diario = document.createElement('div');
  diario.className = 'card';
  const patron = sintomaPattern();
  let patronHtml = '';
  if (patron) {
    patronHtml = patron.tipo === 'disparador'
      ? `<p class="small mt" style="border-left:4px solid var(--accent);padding-left:10px">💡 <strong>Hemos notado</strong> que <strong>${esc(patron.valor)}</strong> aparece seguido en tus registros. Puede ser tu disparador.</p>`
      : `<p class="small mt" style="border-left:4px solid var(--accent);padding-left:10px">💡 <strong>Hemos notado</strong> que tus síntomas suelen aparecer en la <strong>${patron.valor}</strong>.</p>`;
  }
  diario.innerHTML = `
    <div class="spread"><h2>📋 Diario de síntomas</h2></div>
    <p class="small">${sintomas.length ? `Registrados: ${sintomas.length}` : 'Registra gases, hinchazón, estreñimiento, diarrea o migraña, y con el tiempo te ayudamos a ver qué los dispara.'}</p>
    ${patronHtml}
    <button class="btn quiet sm mt" id="btn-log-sintoma">+ Registrar síntoma</button>`;
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
    habitosEl.innerHTML = '<p class="small muted">Aún no hay datos suficientes. Vuelve mañana.</p>';
    aguaEl.innerHTML = '';
    return;
  }

  let items;
  if (rangoActivo === 'dia') {
    const ultimos = dias.slice(-7);
    items = ultimos.map((d) => ({
      label: DIAS_CORTOS[new Date(d.fecha + 'T00:00:00').getDay()],
      habitosPct: (d.habitosCompletados / (d.habitosTotal || 5)) * 100,
      aguaPct: d.metaAgua ? (d.vasosAgua / d.metaAgua) * 100 : 0
    }));
  } else if (rangoActivo === 'semana') {
    items = agruparPorSemana(dias).slice(-6);
  } else {
    items = agruparPorMes(dias).slice(-6);
  }

  if (items.length < 2) {
    habitosEl.innerHTML = '<p class="small muted">Necesitas un par de días más de historial para ver esta vista.</p>';
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
    const mes = parseInt(d.fecha.slice(5, 7), 10) - 1;
    if (!grupos[key]) grupos[key] = { fechas: [], habitosPct: 0, aguaPct: 0, label: MESES_CORTOS[mes] };
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
    return `<h2>🔭 Si mantienes tu ritmo</h2>
      <p class="small mt">Registra unos días más de hábitos para que podamos mostrarte una proyección de tu constancia.</p>`;
  }
  const tasa = dias.reduce((acc, d) => acc + d.habitosCompletados / (d.habitosTotal || 5), 0) / dias.length;
  const semanas = [1, 2, 3, 4].map((n) => ({
    label: `Sem ${n}`,
    value: Math.round(Math.min(7, tasa * 7) * n)
  }));
  return `<h2>🔭 Si mantienes tu ritmo</h2>
    <p class="small mt">En tus últimos ${dias.length} días registrados cumples en promedio el <strong>${Math.round(tasa * 100)}%</strong> de tus hábitos diarios.
    Así se vería tu constancia acumulada si mantienes ese ritmo:</p>
    <div class="mt">${barChart(semanas, { color: 'var(--primary)', suffix: 'd' })}</div>
    <p class="small muted mt">Esto es una proyección de tu constancia con la app, no un pronóstico de salud. Tus resultados dependen de muchos factores; revísalos siempre con tu profesional de salud.</p>`;
}

function openSintomaModal(onSaved) {
  let tipo = null;
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <h2>📋 Registrar síntoma</h2>
      <p class="small mt">¿Qué sentiste?</p>
      <div class="chips mt" id="sintoma-chips"></div>
      <p class="small mt" id="sintoma-causa" style="border-left:4px solid var(--secondary);padding-left:10px;display:none"></p>
      <label class="muted small mt" for="sintoma-disparador" style="display:block">¿Sospechas qué lo causó? (opcional)</label>
      <input id="sintoma-disparador" type="text" maxlength="60" placeholder="Ej: cebolla, lácteos, estrés…"
        style="width:100%;padding:12px;border-radius:12px;border:1.5px solid #D8E6E2;font:inherit;margin-top:8px">
      <button class="btn full mt" id="sintoma-guardar" disabled>Guardar</button>`);
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
      toast('Registrado. Cada dato te ayuda a entender tu cuerpo 🌱');
      if (onSaved) onSaved();
    });
  });
}

function labelTipo(t) {
  return { dulce: 'Antojo de dulce', salado: 'Antojo salado', alcohol: 'Alcohol', picoteo: 'Picoteo nocturno', no_se: 'Ansiedad general' }[t] || t;
}

function labelTipoSintoma(t) {
  const found = SYMPTOM_TYPES.find((s) => s.id === t);
  return found ? `${found.emoji} ${found.nombre}` : t;
}
