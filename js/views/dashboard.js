// Dashboard diario: menú del día, agua, hábitos y acceso rápido al SOS.
//
// Solo lo que se usa gratis todos los días vive aquí (paso del día,
// hábitos, agua, menú, SOS). Plan de 7 días, SuSana y la Misión tienen
// su propia pantalla/pestaña ahora (Progreso y el tab SuSana en el menú
// inferior) — la usuaria pidió que el dashboard diario no acumule
// tarjetas grandes de cosas que no se usan todos los días.
import { getState, getWater, setWater, getHabits, toggleHabit, cravingPattern, checkAchievements, esc, isPremium, pasoDeHoy, pasoHechoHoy, marcarPasoHecho, esTextoReal, guardarReflexionHabitos, registrarComidaSeguida, comidaRegistrada, guardarComidaRegistrada, borrarComidaRegistrada, DEFAULT_HORA_COMIDAS, ACHIEVEMENTS } from '../store.js';
import { PROFILES } from '../data/profiles.js';
import { dailyMenu, swapMeal, trafficLight, displayIngredient, displayRecipe, textoConCantidad, mealsActivas } from '../menu.js';
import { navigate, header, openModal, toast, REFRESH_ICON, PENCIL_ICON, CLOCK_ICON } from '../app.js';
import { t } from '../i18n.js';
import { celebrateStreak, habitCheckPop } from '../streakAnim.js';
import { playCheckSound, playWaterSound, playSparkleSound, playCelebrateSound } from '../sound.js';
import { renderPathMap } from '../pathMap.js';
import { tourVisible, iniciarTour } from './tour.js';
import { renderCheckinBanner, checkinBannerVisible } from './checkin.js';
import { renderNotifPrompt, notifPromptVisible } from './notifPrompt.js';
import { openMealLogModal } from './mealLogModal.js';
import { openKitchenSearchModal } from './kitchenSearchModal.js';

const DAILY_HABITS = [
  { id: 'agua', nombre: 'Tomé suficiente agua 💧' },
  { id: 'movimiento', nombre: 'Me moví 30 minutos 🚶‍♀️' },
  { id: 'sin_azucar', nombre: 'Evité azúcar añadida 🍬' },
  { id: 'menu', nombre: 'Seguí el menú del día 🍽️' },
  { id: 'sueno', nombre: 'Dormí 7+ horas 😴' }
];
// "agua" y "menu" ya no se marcan a mano: se derivan de una acción real
// (vasos llenados de verdad / al menos 2 comidas del día abiertas) — para
// que no sean solo un tap sin haberlo hecho. Los otros 3 siguen siendo
// auto-reporte (no hay forma de verificarlos sin un wearable), pero piden
// una reflexión real al cruzar el umbral de racha (ver pedirReflexionHabitos).
const AUTO_HABITS = new Set(['agua', 'menu']);

export function renderDashboard(container) {
  header(container);
  const state = getState();
  const { user } = state;
  const hora = new Date().getHours();
  const saludo = t(hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches');
  const mood = sanaMood(state);

  // --- Saludo + Check-in, a dos columnas cuando ambas existen (si no hay
  // check-in pendiente, el saludo se queda solo, a ancho completo) ---
  // flex:1;min-width:0 en cada columna es lo que evita que el chip de
  // perfiles largo o cualquier texto empuje el ancho de la página --
  // sin min-width:0 un hijo flex nunca se encoge más que su contenido,
  // y eso fue justo lo que rompió el header con NutriCoins.
  const hero = document.createElement('div');
  hero.className = 'card';
  hero.innerHTML = `
    <h2>${saludo}${user.nombre ? ', ' + esc(user.nombre) : ''} 🌿</h2>
    <p class="small">${t('Hoy es un buen día para cuidarte. Progreso, no perfección.')}</p>`;

  if (checkinBannerVisible()) {
    const fila = document.createElement('div');
    fila.className = 'row';
    fila.style.cssText = 'gap:8px;align-items:stretch';
    hero.style.cssText = 'flex:1;min-width:0';
    fila.appendChild(hero);
    container.appendChild(fila);
    // Sin envoltorio extra alrededor de la tarjeta de check-in -- un div
    // intermedio (aunque fuera display:flex con min-width:0) hacía que el
    // reparto 1:1 del flex dejara de ser exacto (bug real de flexbox
    // anidado, confirmado midiendo con getBoundingClientRect: con el
    // envoltorio quedaba 226px vs 194px, sin él, 209.5px las dos). La
    // tarjeta real de renderCheckinBanner pasa a ser hija directa de
    // `fila`, igual que "hero" -- así se estira parejo con align-items:stretch.
    renderCheckinBanner(fila, () => renderDashboard(clearAndGet(container)));
    const checkinCard = fila.children[1];
    if (checkinCard) checkinCard.style.cssText = 'flex:1;min-width:0';
  } else {
    container.appendChild(hero);
  }

  // --- Progreso: antes vivía como su propia pestaña en la barra
  // inferior; la usuaria pidió sacarla de ahí y ponerla como acceso
  // directo aquí, justo debajo del saludo/check-in. Tarjeta tipo
  // carrusel (referencia real: el banner deslizable de Huawei Health,
  // con puntos de paginación abajo) en vez de una sola tarjeta plana --
  // cada slide es un vistazo distinto a datos reales (racha, semana,
  // logros), nunca inventados, y las 3 llevan a la pantalla completa de
  // Progreso al tocarlas.
  container.appendChild(renderProgresoCarrusel(state, container));

  // --- Notificaciones: se piden aquí, cuando ya hay una racha que
  // proteger, no enterrado en Ajustes. También descartable. ---
  if (notifPromptVisible()) {
    renderNotifPrompt(container, () => renderDashboard(clearAndGet(container)));
  }

  // --- Tu paso de hoy: la tarjeta principal del día, con Sana como voz ---
  const paso = pasoDeHoy();
  const pasoHecho = pasoHechoHoy();
  // Antes usaba pasoRacha() -- una racha PARALELA, calculada solo sobre
  // los días que se tocó "Ya lo hice" aquí, que podía desincronizarse de
  // la racha real (arriba en el header): alguien completaba su día por
  // hábitos sin marcar este botón puntual, y los dos números no
  // coincidían. Ahora muestra la misma racha de siempre, un solo número
  // en toda la app.
  const pasoRachaActual = state.racha.actual;
  const pasoCard = document.createElement('div');
  pasoCard.id = 'tour-paso';
  pasoCard.className = 'card';
  pasoCard.style.background = 'linear-gradient(135deg, var(--primary-soft), var(--secondary-soft))';
  pasoCard.style.border = 'none';
  pasoCard.innerHTML = `
    <div class="row" style="gap:12px;align-items:flex-start">
      <div class="sana-avatar">🌿${mood.badge ? `<span class="mood-badge">${mood.badge}</span>` : ''}</div>
      <div style="flex:1;min-width:0">
        <div class="spread"><h3>${t('Tu paso de hoy')}</h3>${pasoHecho ? `<span class="tag verde">${t('Hecho ✓')}</span>` : ''}</div>
        <p class="small mt" style="font-weight:600">${esc(paso.obstaculo)}</p>
        <p class="mt">${esc(paso.accion)}</p>
        <p class="small muted mt">${esc(paso.porque)}</p>
        ${pasoRachaActual >= 2 ? `<p class="small mt">🔥 ${t('{n} Días en Ruta dando tu paso', { n: pasoRachaActual })}</p>` : ''}
        <button class="btn ${pasoHecho ? 'ghost' : 'accent'} full mt" id="paso-btn" ${pasoHecho ? 'disabled' : ''}>${pasoHecho ? t('Completado por hoy 🌿') : t('Ya lo hice ✓')}</button>
      </div>
    </div>`;
  const pasoBtn = pasoCard.querySelector('#paso-btn');
  pasoBtn.addEventListener('click', () => {
    const rect = pasoBtn.getBoundingClientRect();
    habitCheckPop(rect.left + rect.width / 2, rect.top + rect.height / 2);
    playSparkleSound();
    const nuevaRacha = marcarPasoHecho();
    if (nuevaRacha >= 2) celebrateStreak(nuevaRacha);
    else toast('¡Bien hecho! 🌿');
    renderDashboard(clearAndGet(container));
  });
  container.appendChild(pasoCard);

  // --- Hábitos: el ciclo diario central, justo después del paso de hoy ---
  const checks = getHabits();
  const habitCard = document.createElement('div');
  habitCard.id = 'tour-habitos';
  habitCard.className = 'card';
  habitCard.innerHTML = `<h2>✅ ${t('Hábitos de hoy')}</h2><p class="small">${t('Marca al menos 3 para sumar a tu Ruta. Agua y menú se marcan solos.')}</p>`;
  for (const h of DAILY_HABITS) {
    const row = document.createElement('div');
    const auto = AUTO_HABITS.has(h.id);
    row.className = 'habit' + (checks[h.id] ? ' done' : '') + (auto ? ' habit-auto' : '');
    if (auto) {
      row.innerHTML = `
        <span class="habit-auto-dot" aria-hidden="true">${checks[h.id] ? '✓' : ''}</span>
        <label>${t(h.nombre)} <span class="muted small">· ${t('automático')}</span></label>`;
      habitCard.appendChild(row);
      continue;
    }
    row.innerHTML = `
      <input type="checkbox" id="h-${h.id}" ${checks[h.id] ? 'checked' : ''}>
      <label for="h-${h.id}">${t(h.nombre)}</label>`;
    const input = row.querySelector('input');
    input.addEventListener('change', (e) => {
      const marcando = e.target.checked;
      const completadosAntes = Object.values(checks).filter(Boolean).length;
      const cruzaUmbral = marcando && completadosAntes < 3 && completadosAntes + 1 >= 3;
      const confirmar = () => {
        if (marcando) {
          const rect = row.getBoundingClientRect();
          habitCheckPop(rect.left + 16, rect.top + rect.height / 2);
          playCheckSound();
        }
        const rachaAntes = getState().racha.actual;
        const escudoUsado = toggleHabit(h.id);
        celebrarSiSubioRacha(rachaAntes, escudoUsado);
        renderDashboard(clearAndGet(container));
      };
      if (cruzaUmbral) {
        e.target.checked = false; // se revierte visualmente hasta confirmar la reflexión
        pedirReflexionHabitos(confirmar);
      } else {
        confirmar();
      }
    });
    habitCard.appendChild(row);
  }
  container.appendChild(habitCard);

  // --- Agua: ahora vive en un modal (ver abrirModalAgua), que se abre
  // desde su propio botón en el carrusel de "Tu progreso" -- ya no ocupa
  // una tarjeta fija en el dashboard.

  // --- Aviso de patrón de antojos (función Premium) ---
  const patron = isPremium() ? cravingPattern() : null;
  if (patron) {
    const tip = document.createElement('div');
    tip.className = 'card';
    tip.style.borderLeft = '4px solid var(--accent)';
    tip.innerHTML = `<p class="small">💡 <strong>${t('Hemos notado')}</strong> ${t('que tus antojos suelen aparecer en la')} <strong>${patron}</strong>. ${t('Prepara con anticipación un snack saludable para ese momento.')}</p>`;
    container.appendChild(tip);
  }

  // --- Aviso de hidratación/ayuno para migrañas: mitad del día, poca agua ---
  if (user.perfiles.includes('migranas') && hora >= 14 && getWater().vasos <= 1) {
    const migTip = document.createElement('div');
    migTip.className = 'card';
    migTip.style.borderLeft = '4px solid var(--secondary)';
    migTip.innerHTML = `<p class="small">🧠💧 ${t('Vas con poca agua hoy y en migrañas los horarios y la hidratación importan tanto como la comida. Toma un vaso y no dejes pasar mucho tiempo sin comer.')}</p>`;
    container.appendChild(migTip);
  }

  // --- Menú del día: la ruta de hoy ---
  const menuCard = document.createElement('div');
  menuCard.className = 'card';
  menuCard.id = 'tour-menu';
  menuCard.innerHTML = `<div class="spread"><h2>${t('🍽️ Tu ruta de hoy')}</h2></div><div id="menu-path"></div>`;
  // insertBefore(pasoCard) en vez de appendChild -- pedido explícito de
  // la usuaria: "Tu ruta de hoy" debe quedar ARRIBA de "Tu paso de hoy",
  // aunque su contenido (menú, path map, accesos) se siga armando acá
  // abajo en el código, después de habitCard y los avisos.
  container.insertBefore(menuCard, pasoCard);

  // Hora de inicio real (24h) de cada comida, en el mismo orden que MEALS
  // — ya no es una franja fija igual para todo el mundo: cada quien la
  // ajusta a su rutina real en Ajustes (user.horaComidas). Si una cuenta
  // vieja no tiene este campo guardado (creada antes de que existiera),
  // cae en DEFAULT_HORA_COMIDAS por comida -- nunca en 0, que rompería la
  // ventana de "ahora" (todo el día caería en la última comida).
  const horasUsuario = getState().user.horaComidas || {};
  // mealsActivas(), no MEALS -- si la usuaria desactivó alguna comida en el
  // quiz/Ajustes, dailyMenu() ya la excluye del menú de abajo; este arreglo
  // tiene que tener el mismo orden y largo para que el índice `i` de cada
  // fila siga apuntando a la comida correcta (si no, "Ahora" quedaría mal
  // calculado en cuanto faltara una comida).
  const HORAS_INICIO_COMIDA = mealsActivas(getState().user).map((m) => Number.isFinite(horasUsuario[m.id]) ? horasUsuario[m.id] : DEFAULT_HORA_COMIDAS[m.id]);
  const horaActual = new Date().getHours();
  const menuHoy = dailyMenu();
  const menuItems = menuHoy.map(({ meal, recipe }, i) => {
    const horaInicio = HORAS_INICIO_COMIDA[i] ?? 0;
    const horaSiguiente = HORAS_INICIO_COMIDA[i + 1] ?? 24;
    const esAhora = horaActual >= horaInicio && horaActual < horaSiguiente;
    // Completado de verdad = registró (foto/voz/texto) lo que comió en esa
    // estación, no solo que abrió la receta sugerida (eso es comidasSeguidas,
    // una señal distinta y más floja que ya existía).
    const registro = comidaRegistrada(meal.id);
    // Nota de horario real vs. programado -- misma idea que ya usa SuSana
    // para saber que "desayunó tarde": si lo que registró en esta
    // estación quedó 2+ horas fuera de su horario configurado, se avisa
    // en la propia fila en vez de solo saberlo la IA. No cambia el ✓
    // (eso sigue siendo "lo registró", no "lo registró a tiempo").
    const notaHorario = (() => {
      if (!registro) return '';
      const horaLog = new Date(registro.hora).getHours();
      const diff = horaLog - horaInicio;
      if (diff >= 2) return ` · ${t('registrado más tarde de lo programado')}`;
      if (diff <= -2) return ` · ${t('registrado más temprano de lo programado')}`;
      return '';
    })();
    if (!recipe) {
      return { icon: meal.emoji, title: t(meal.nombre), subtitle: t('Sin opciones con tus exclusiones actuales'), now: esAhora, nowLabel: t('Ahora'), done: !!registro };
    }
    const { perfiles, exclusiones } = getState().user;
    const light = trafficLight(recipe, perfiles);
    const shown = displayRecipe(recipe, exclusiones);
    return {
      // El ícono es el de la RECETA actual (shown.emoji), no el de la
      // comida (meal.emoji) -- antes eran fijos por Desayuno/Almuerzo/etc.
      // y nunca cambiaban al tocar 🔄, aunque la receta sí fuera otra.
      icon: shown.emoji, title: t(meal.nombre),
      subtitle: registro ? registro.alimentos.join(', ') + notaHorario : shown.nombre,
      now: esAhora, nowLabel: t('Ahora'), done: !!registro,
      onClick: () => {
        // Abrir una comida real del menú de hoy es la señal de "seguí el
        // menú" — con 2 comidas abiertas se marca sola (ver store.js).
        const rachaAntes = getState().racha.actual;
        const { escudoUsado } = registrarComidaSeguida(recipe.id) || {};
        celebrarSiSubioRacha(rachaAntes, escudoUsado);
        // El semáforo y el botón de "Comí esto" viven DENTRO de la modal
        // ahora (ver openRecipe) -- la fila de afuera se veía sobrecargada
        // con 4 señales a la vez, y el punto de color solo no se entendía
        // como semáforo sin más contexto.
        openRecipe(recipe, { mealId: meal.id, registro, onRegistrado: () => renderDashboard(clearAndGet(container)) });
      },
      extraHtml: `<div class="row mt" style="gap:2px">
        <button type="button" class="icon-btn plain swap-btn" title="${t('Cambiar receta')}" aria-label="${t('Cambiar receta')}">${REFRESH_ICON}</button>
        <button type="button" class="icon-btn plain log-btn" style="margin-left:-12px" title="${registro ? t('Editar lo que comiste') : t('Comí algo diferente')}" aria-label="${registro ? t('Editar lo que comiste') : t('Registrar lo que comiste')}">${registro ? '✏️' : '📸'}</button>
      </div>`
    };
  });
  renderPathMap(menuCard.querySelector('#menu-path'), menuItems, { showLine: false });
  menuHoy.forEach(({ meal, recipe }, i) => {
    const logBtn = menuCard.querySelector(`[data-row-idx="${i}"] .log-btn`);
    if (logBtn) logBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMealLogModal(meal.id, meal.nombre, () => renderDashboard(clearAndGet(container)));
    });
    if (!recipe) return;
    const btn = menuCard.querySelector(`[data-row-idx="${i}"] .swap-btn`);
    if (btn) btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Vuelve al comportamiento original: actualiza directo a la
      // siguiente opción del mismo lugar, sin abrir una modal -- pedido
      // explícito de la usuaria, la modal de alternativas se sentía como
      // un paso de más para algo que antes era instantáneo.
      swapMeal(meal.id);
      renderDashboard(clearAndGet(container));
    });
  });

  // La fila de accesos ("¿Qué tienes en casa?"/"Ver la semana") se quitó
  // de acá -- ahora viven como botones propios en el carrusel de "Tu
  // progreso" arriba ("En casa"/"Semana"), y quedarían repetidos si se
  // dejaban también en esta tarjeta.

  // --- Botón SOS ---
  const sosBtn = document.createElement('button');
  sosBtn.className = 'btn accent full mb';
  sosBtn.innerHTML = t('💚 Tengo ansiedad / antojo');
  sosBtn.addEventListener('click', () => navigate('sos'));
  container.appendChild(sosBtn);

  // Plan de 7 días, Guía (SuSana) y Misión 12 semanas se movieron a
  // Progreso (ver progress.js) — la usuaria pidió que el dashboard diario
  // no acumule tarjetas grandes de cosas que no se usan todos los días;
  // ese contenido encaja mejor en la pantalla dedicada a ver tu progreso.

  // Minitutorial guiado: recién al final, con todo ya en el DOM (incluido
  // el menú inferior, que vive fuera de este container). El chequeo de
  // "ya hay uno corriendo" evita duplicar el overlay si algo externo
  // vuelve a llamar renderDashboard mientras el tour sigue a medias.
  if (tourVisible() && !document.querySelector('.tour-overlay')) {
    iniciarTour(() => renderDashboard(clearAndGet(container)));
  }
}

// Carrusel de accesos rápidos del dashboard -- fila de botones
// circulares deslizable, mismo lenguaje visual que "Tu Plan Fit"/
// "Música"/"Cursos" del video de referencia (Huawei Health) y que el
// carrusel de divisiones de Liga (ícono + etiqueta corta, sin fondo de
// tarjeta). El primero es el botón "Progreso" -- el mismo que antes
// vivía en la barra inferior, movido tal cual acá, sin partirlo en
// varios: al tocarlo abre la pantalla completa de siempre (gráficas,
// proyección, logros...), sin modal. Los que siguen se van agregando a
// la derecha uno por uno según los vaya pidiendo la usuaria -- por ahora
// solo "Agua" (antes era una tarjeta fija en el dashboard, ver
// abrirModalAgua).
function renderProgresoCarrusel(state, container) {
  const agua = getWater();

  const botones = [
    { icon: '💧', label: t('Agua'), valor: `${agua.vasos}/${agua.meta}`, onTap: () => abrirModalAgua(container), id: 'tour-agua' },
    { icon: '📅', label: t('Semana'), onTap: () => navigate('weekMenu') },
    { icon: '🛒', label: t('Lista'), onTap: () => navigate('planner', { tab: 'compras' }) },
    { icon: '📈', label: t('Progreso'), onTap: () => navigate('progress') },
    { icon: '📔', label: t('Diario'), onTap: () => navigate('diary') },
    { icon: '🎖️', label: t('Logros'), valor: `${state.logros.length}/${ACHIEVEMENTS.length}`, onTap: () => abrirModalLogros(state) },
    { icon: '🔍', label: t('En casa'), onTap: () => openKitchenSearchModal((recipe) => openRecipe(recipe)) }
  ];

  const carrusel = document.createElement('div');
  carrusel.className = 'progreso-botones mt';
  for (const b of botones) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'progreso-boton';
    if (b.id) btn.id = b.id;
    btn.innerHTML = `
      <span class="progreso-boton-icon">${b.icon}</span>
      <span class="progreso-boton-label">${esc(b.label)}</span>
      ${b.valor ? `<span class="progreso-boton-valor">${esc(b.valor)}</span>` : ''}`;
    btn.addEventListener('click', b.onTap);
    carrusel.appendChild(btn);
  }
  return carrusel;
}

// Modal de agua -- antes era una tarjeta fija en el dashboard, ahora se
// abre desde su botón en el carrusel de "Tu progreso" (pedido explícito
// de la usuaria: liberar espacio del dashboard). Misma lógica de
// siempre (tocar un vaso lo llena, tocar uno ya lleno vacía desde ahí
// en adelante), solo que ahora en grilla de columnas fijas en vez de una
// fila que envolvía de forma dispareja -- "filas pares", ordenadas.
function abrirModalAgua(container) {
  openModal((modal, closeFn) => {
    // wrap propio -- openModal ya agregó su botón "✕" como hijo directo
    // de `modal` antes de llamar acá; pintar() se llama de nuevo en cada
    // vaso tocado, y modal.innerHTML= lo habría borrado (bug real que se
    // encontró probando: el botón de cerrar desaparecía al primer tap).
    const wrap = document.createElement('div');
    modal.appendChild(wrap);

    function pintar() {
      const agua = getWater();
      wrap.innerHTML = `
        <div class="spread"><h2>${t('💧 Agua')}</h2><span class="muted small">${agua.vasos}/${agua.meta} ${t('vasos')}</span></div>
        <div class="water-glasses mt"></div>`;
      const glassesEl = wrap.querySelector('.water-glasses');
      for (let i = 0; i < agua.meta; i++) {
        const g = document.createElement('button');
        g.className = 'glass' + (i < agua.vasos ? ' filled' : '');
        g.innerHTML = '<svg viewBox="0 0 24 28" width="22" height="26"><path d="M4 2h16l-1.6 22.5a2 2 0 0 1-2 1.5H7.6a2 2 0 0 1-2-1.5L4 2z" fill="currentColor"/><path d="M4 8.5c2 1.4 4 1.4 6 0s4-1.4 6 0 4 1.4 6 0" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.4"/></svg>';
        g.setAttribute('aria-label', t('Vaso {n}', { n: i + 1 }));
        g.addEventListener('click', () => {
          const nuevo = i < agua.vasos ? i : i + 1;
          if (nuevo > agua.vasos) {
            const rect = g.getBoundingClientRect();
            habitCheckPop(rect.left + rect.width / 2, rect.top + rect.height / 2);
            playWaterSound();
          }
          const rachaAntes = getState().racha.actual;
          const { escudoUsado } = setWater(nuevo);
          if (nuevo >= agua.meta) toast(t('¡Meta de agua cumplida! 💧🎉'));
          celebrarSiSubioRacha(rachaAntes, escudoUsado);
          pintar();
          // El modal vive en <body>, fuera de `container` -- redibujar el
          // dashboard detrás no lo toca, y así el botón "Agua" del
          // carrusel refleja el conteo nuevo sin esperar a cerrar el modal.
          renderDashboard(clearAndGet(container));
        });
        glassesEl.appendChild(g);
      }
    }
    pintar();
  });
}

// Modal de logros -- misma grilla de insignias (.badges/.badge) que ya
// pinta la pantalla completa de Progreso, solo que en un vistazo rápido
// desde el dashboard. Snapshot del `state` recibido al abrir: no necesita
// redibujarse solo, los logros no cambian mientras el modal está abierto.
function abrirModalLogros(state) {
  openModal((modal) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = '<h2>🎖️ Logros</h2><div class="badges mt"></div>';
    const grid = wrap.querySelector('.badges');
    for (const a of ACHIEVEMENTS) {
      const unlocked = state.logros.includes(a.id);
      const b = document.createElement('div');
      b.className = 'badge' + (unlocked ? '' : ' locked');
      b.title = a.desc;
      b.innerHTML = `<div class="emoji">${a.emoji}</div><span class="small"><strong>${esc(a.nombre)}</strong></span>`;
      grid.appendChild(b);
    }
    modal.appendChild(wrap);
  });
}

// Estado de ánimo de Sana: se deriva 100% de datos que ya existen (último
// check-in, racha, hábitos de hoy) — nada nuevo que trackear. Nunca es
// negativa de más: ante la duda, la lectura queda en calma.
function sanaMood(state) {
  const ultimo = state.checkins?.length ? state.checkins[state.checkins.length - 1] : null;
  const animoDificil = ultimo?.animo === 'dificil';
  const habitosHoy = Object.values(state.habitos?.checks || {}).filter(Boolean).length;
  const rachaEnRiesgo = (state.racha?.actual || 0) >= 2 && habitosHoy < 3 && new Date().getHours() >= 18;
  if (animoDificil || rachaEnRiesgo) return { badge: '🤗' };
  if ((state.racha?.actual || 0) >= 3) return { badge: '✨' };
  return { badge: '' };
}

function clearAndGet(container) {
  container.innerHTML = '';
  return container;
}

// Compartido entre el toggle de hábitos, el agua y el abrir una comida del
// menú — cualquiera de los tres puede ser lo que complete el día.
function celebrarSiSubioRacha(rachaAntes, escudoUsado) {
  const rachaDespues = getState().racha.actual;
  const nuevos = checkAchievements();
  if (escudoUsado) toast('🛡️ Usamos una Pausa de Ruta — tu Ruta sigue en pie');
  if (rachaDespues > rachaAntes) {
    const checksAhora = getHabits();
    const completados = Object.values(checksAhora).filter(Boolean).length;
    const aguaAhora = getWater();
    playCelebrateSound();
    celebrateStreak(rachaDespues, { habitos: completados, totalHabitos: DAILY_HABITS.length, vasos: aguaAhora.vasos, meta: aguaAhora.meta });
  }
  if (nuevos.length) toast('🏆 ¡Nuevo logro desbloqueado! Míralo en Progreso.');
}

// Reflexión breve (anti-trampa, ver memoria) justo al cruzar el umbral de
// 3 hábitos: pedir una frase real de qué se hizo es más fácil de cumplir
// honestamente que de inventar en frío. Solo aplica a los 3 hábitos que
// siguen siendo auto-reporte (movimiento, azúcar, sueño) — agua y menú ya
// se derivan de una acción real y no pasan por aquí.
function pedirReflexionHabitos(onConfirm) {
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <div style="font-size:2rem">✍️</div>
      <h2>Antes de sumar hoy…</h2>
      <p class="small mt">En una frase, ¿qué hiciste hoy para esto? Nos ayuda a que tu Ruta refleje algo real, no solo un toque.</p>
      <textarea id="reflexion-habitos" maxlength="300" rows="3" placeholder="Ej: Caminé 30 minutos después de almorzar..."
        class="auth-input" style="resize:vertical"></textarea>`);
    const textarea = modal.querySelector('#reflexion-habitos');
    const btn = document.createElement('button');
    btn.className = 'btn full mt';
    btn.textContent = 'Sumar a mi Ruta ✓';
    btn.disabled = true;
    textarea.addEventListener('input', () => { btn.disabled = !esTextoReal(textarea.value, 12); });
    btn.addEventListener('click', () => {
      guardarReflexionHabitos(textarea.value);
      close();
      onConfirm();
    });
    modal.appendChild(btn);
  });
}

// Semáforo con texto, no solo el punto de color -- dentro de "Tu ruta de
// hoy" el punto solo (sin la palabra "Semáforo" al lado, que sí tenía la
// versión anterior de esta modal) no se entendía como semáforo. Frases
// cortas y claras por color, mismo criterio en las 3.
const SEMAFORO_TEXTO = { verde: t('Apto para tu perfil'), amarillo: t('Modera esto'), rojo: t('Evita esto') };

// Semáforo horizontal de verdad (3 luces), no solo un punto -- con la
// luz que corresponde encendida a color completo y las otras dos
// apagadas, pero SIN perder su color (rojo/amarillo/verde opacos, no
// gris) -- así se entiende que es un semáforo real, no solo un punto
// resaltado. Al lado de la etiqueta de texto, nunca reemplazándola.
function semaforoIcon(light) {
  const color = { rojo: 'var(--red)', amarillo: 'var(--yellow)', verde: 'var(--green)' };
  const opacidad = (c) => c === light ? '1' : '0.25';
  return `<svg width="44" height="16" viewBox="0 0 44 16" aria-hidden="true" style="display:block;flex:none">
    <circle cx="8" cy="8" r="6" fill="${color.rojo}" fill-opacity="${opacidad('rojo')}"/>
    <circle cx="22" cy="8" r="6" fill="${color.amarillo}" fill-opacity="${opacidad('amarillo')}"/>
    <circle cx="36" cy="8" r="6" fill="${color.verde}" fill-opacity="${opacidad('verde')}"/>
  </svg>`;
}

// Detalle de receta en modal (compartido con planner/SOS/Plan 7 días/
// buscador de despensa). El segundo parámetro `hoy` es opcional y solo lo
// pasa "Tu ruta de hoy" (dashboard.js): agrega el semáforo con su
// etiqueta y el botón de "Comí esto" -- de otro modo (recetario, SOS,
// etc.) esta misma modal se ve exactamente igual que antes, sin esa
// sección, porque "marcar como comido HOY" solo tiene sentido para una
// comida real del día, no para cualquier receta que se está mirando.
export function openRecipe(recipe, hoy = null) {
  const { user } = getState();
  openModal((modal, closeFn) => {
    const light = trafficLight(recipe, user.perfiles);
    const shown = displayRecipe(recipe, user.exclusiones);
    // Lista editable (referencia real: Fitia) -- empieza igual a la
    // sugerencia, pero cada ingrediente se puede ajustar o quitar, y se
    // puede agregar uno nuevo. Es esta lista, no el nombre fijo de la
    // receta, la que se guarda al tocar el círculo de "¿Comiste esto?"
    // -- así el registro refleja lo que de verdad comiste, no la
    // sugerencia sin editar.
    let ingredientesTexto = recipe.ingredientes.map((ing) => {
      const d = displayIngredient(ing, user.exclusiones);
      const texto = (d.cantidad != null && d.resto) ? textoConCantidad(d.cantidad, d.resto, user.unidades) : d.texto;
      return texto + (d.sustituido ? ` (${t('sustituto de')} ${d.original})` : '');
    });
    let registradoAhora = !!hoy?.registro;
    modal.insertAdjacentHTML('beforeend', `
      <div class="center" style="font-size:2.4rem">${shown.emoji}</div>
      <h2 class="center">${shown.nombre}</h2>
      ${recipe.tiempoMin ? `<p class="small muted center row" style="gap:5px;justify-content:center;align-items:center;margin-top:2px">${CLOCK_ICON}${recipe.tiempoMin} min</p>` : ''}
      <p class="small mt">${recipe.descripcion}</p>
      <p class="row mt" style="gap:8px;align-items:center">
        ${semaforoIcon(light)}<span class="tag ${light}">${SEMAFORO_TEXTO[light] || light}</span>
      </p>
      <p class="mt">${recipe.apto.filter((p) => user.perfiles.includes(p)).map((p) => `<span class="tag perfil">${PROFILES[p].nombre}</span>`).join(' ')}</p>
      ${hoy ? `<div class="row mt" style="gap:10px;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--modal-bg);border:1px solid var(--border);border-radius:14px">
        <span class="small" id="rc-check-label">${registradoAhora ? t('¡Comiste esto! Toca para deshacer') : t('¿Comiste esto?')}</span>
        <button type="button" class="meal-check${registradoAhora ? ' done' : ''}" id="rc-check-toggle" aria-label="${t('Marcar como comido')}">${registradoAhora ? '✓' : ''}</button>
      </div>
      <p class="small muted center mt">${t('¿Comiste algo diferente? Usa el ícono de cámara en Tu ruta de hoy.')}</p>` : ''}
      <h3 class="mt">${t('Ingredientes')}</h3>
      <div id="rc-ingredientes"></div>
      <button type="button" class="row" id="rc-agregar-ing" style="gap:6px;padding:10px 0;color:var(--primary-dark);font-weight:700;width:100%">+ ${t('Agregar Ingrediente')}</button>
      <details class="rc-desplegable mt">
        <summary>${t('Preparación')}<span class="rc-chev">⌄</span></summary>
        <div class="rc-desplegable-body">
          <ol class="steps">${recipe.pasos.map((p) => `<li>${p}</li>`).join('')}</ol>
        </div>
      </details>`);

    const ingsWrap = modal.querySelector('#rc-ingredientes');
    function pintarIngredientes() {
      ingsWrap.innerHTML = ingredientesTexto.map((texto, i) => `
        <div class="row ingredient-row" data-idx="${i}" style="gap:8px;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span class="ing-text" style="flex:1;min-width:0">${esc(texto)}</span>
          <button type="button" class="icon-btn plain ing-edit" data-idx="${i}" aria-label="${t('Editar ingrediente')}">${PENCIL_ICON}</button>
        </div>`).join('');
      ingsWrap.querySelectorAll('.ing-edit').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.idx);
          const fila = btn.closest('.ingredient-row');
          const span = fila.querySelector('.ing-text');
          const input = document.createElement('input');
          input.type = 'text'; input.className = 'auth-input'; input.value = ingredientesTexto[i];
          input.style.cssText = 'flex:1;min-width:0;padding:6px 10px;font-size:0.95rem';
          span.replaceWith(input);
          input.focus(); input.select();
          const commit = () => {
            ingredientesTexto[i] = input.value.trim() || ingredientesTexto[i];
            pintarIngredientes();
          };
          input.addEventListener('blur', commit);
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
        });
      });
    }
    pintarIngredientes();
    modal.querySelector('#rc-agregar-ing').addEventListener('click', () => {
      ingredientesTexto.push('');
      pintarIngredientes();
      const filas = ingsWrap.querySelectorAll('.ing-edit');
      filas[filas.length - 1]?.click();
    });

    if (hoy) {
      const toggleBtn = modal.querySelector('#rc-check-toggle');
      const label = modal.querySelector('#rc-check-label');
      toggleBtn.addEventListener('click', () => {
        registradoAhora = !registradoAhora;
        if (registradoAhora) guardarComidaRegistrada(hoy.mealId, ingredientesTexto.filter(Boolean), 'sugerencia');
        else borrarComidaRegistrada(hoy.mealId);
        toggleBtn.classList.toggle('done', registradoAhora);
        toggleBtn.textContent = registradoAhora ? '✓' : '';
        label.textContent = registradoAhora ? t('¡Comiste esto! Toca para deshacer') : t('¿Comiste esto?');
        hoy.onRegistrado?.();
      });
    }
  });
}
