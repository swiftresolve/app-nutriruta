// Dashboard diario: menú del día, agua, hábitos y acceso rápido al SOS.
//
// Solo lo que se usa gratis todos los días vive aquí (paso del día,
// hábitos, agua, menú, SOS). Plan de 7 días, SuSana y la Misión tienen
// su propia pantalla/pestaña ahora (Progreso y el tab SuSana en el menú
// inferior) — la usuaria pidió que el dashboard diario no acumule
// tarjetas grandes de cosas que no se usan todos los días.
import { getState, getWater, setWater, getHabits, toggleHabit, cravingPattern, checkAchievements, esc, isPremium, pasoDeHoy, pasoHechoHoy, marcarPasoHecho, esTextoReal, guardarReflexionHabitos, registrarComidaSeguida, comidaRegistrada, guardarComidaRegistrada, borrarComidaRegistrada, DEFAULT_HORA_COMIDAS, ACHIEVEMENTS } from '../store.js';
import { PROFILES } from '../data/profiles.js';
import { dailyMenu, swapMeal, trafficLight, trafficLightRecetaPropia, displayIngredient, displayRecipe, textoConCantidad, mealsActivas } from '../menu.js';
import { navigate, header, openModal, toast, REFRESH_ICON, PENCIL_ICON, CLOCK_ICON, SPARKLE_ICON, CAMERA_SOLID_ICON, MIC_ICON, TEXTO_ICON, CART_ICON, SHARE_ICON } from '../app.js';
import { t, getIdioma } from '../i18n.js';
import { celebrateStreak, habitCheckPop } from '../streakAnim.js';
import { playCheckSound, playWaterSound, playSparkleSound, playCelebrateSound } from '../sound.js';
import { renderPathMap } from '../pathMap.js';
import { tourVisible, iniciarTour } from './tour.js';
import { renderCheckinBanner, checkinBannerVisible } from './checkin.js';
import { renderNotifPrompt, notifPromptVisible } from './notifPrompt.js';
import { openMealLogModal } from './mealLogModal.js';
import { openKitchenSearchModal } from './kitchenSearchModal.js';
import { abrirCompartirPlantillas } from '../shareUI.js';

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
  // Enlace directo al menú completo del día (pedido explícito: la ruta
  // solo muestra el registro paso a paso, no las 5 comidas de un vistazo)
  // -- esa vista ya existía (weekMenu.js, ícono "Semana" del carrusel de
  // abajo), pero quedaba escondida entre siete íconos chiquitos.
  menuCard.innerHTML = `<div class="spread"><h2>${t('🍽️ Tu ruta de hoy')}</h2><button type="button" class="link-btn small" id="ver-plan-completo">${t('Ver plan completo →')}</button></div><div id="menu-path"></div>`;
  // insertBefore(pasoCard) en vez de appendChild -- pedido explícito de
  // la usuaria: "Tu ruta de hoy" debe quedar ARRIBA de "Tu paso de hoy",
  // aunque su contenido (menú, path map, accesos) se siga armando acá
  // abajo en el código, después de habitCard y los avisos.
  container.insertBefore(menuCard, pasoCard);
  menuCard.querySelector('#ver-plan-completo').addEventListener('click', () => navigate('weekMenu'));

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
    // El "Comí esto" de la modal puede guardar la lista de ingredientes
    // EDITADA completa (varios ítems con cantidades) en vez de un
    // registro corto de foto/voz/texto -- unida con join(', ') sola se
    // volvía un párrafo larguísimo acá, empujando todo lo de abajo
    // (íconos de cambiar/registrar) lejos del nodo. Se corta a un largo
    // razonable para esta fila; el detalle completo sigue intacto en el
    // registro real (Mi Diario, SuSana, etc.), esto es solo el resumen.
    const alimentosTexto = registro ? registro.alimentos.join(', ') : '';
    const subtitleRegistro = alimentosTexto.length > 46 ? `${alimentosTexto.slice(0, 46)}…` : alimentosTexto;
    return {
      // El ícono es el de la RECETA actual (shown.emoji), no el de la
      // comida (meal.emoji) -- antes eran fijos por Desayuno/Almuerzo/etc.
      // y nunca cambiaban al tocar 🔄, aunque la receta sí fuera otra.
      icon: shown.emoji, title: t(meal.nombre),
      subtitle: registro ? subtitleRegistro + notaHorario : shown.nombre,
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
      extraHtml: `<div class="row" style="gap:2px;margin-top:2px">
        <button type="button" class="icon-btn plain swap-btn" title="${t('Cambiar receta')}" aria-label="${t('Cambiar receta')}">${REFRESH_ICON}</button>
        <button type="button" class="icon-btn plain log-btn" style="margin-left:-12px;color:var(--primary-dark)" title="${registro ? t('Editar lo que comiste') : t('Comí algo diferente')}" aria-label="${registro ? t('Editar lo que comiste') : t('Registrar lo que comiste')}">${registro ? PENCIL_ICON : CAMERA_SOLID_ICON}</button>
      </div>`
    };
  });
  // PREVIEW -- línea punteada que se traza sola hasta la comida actual y
  // titila ahí. Si la comida "ahora" ya quedó chuleada (registrada), el
  // trazo avanza un nodo más -- "en camino hacia lo siguiente" en vez de
  // quedarse titilando sobre algo que ya se completó. Si esa comida es
  // la ÚLTIMA del día (cena) y ya está completada, no hay "siguiente"
  // hacia dónde avanzar -- sin este caso, el trazo se quedaba titilando
  // ahí para siempre (se veía como "cargando" sin terminar nunca).
  let activeIndex = menuItems.findIndex((it) => it.now);
  if (activeIndex !== -1 && menuItems[activeIndex].done) {
    activeIndex = activeIndex < menuItems.length - 1 ? activeIndex + 1 : -1;
  }
  // La curva (medida del boceto real de la usuaria) y la posición de cada
  // nodo sobre ella se generan solas dentro de renderPathMap cuando
  // showLine viene activo -- ver curvaRepetida en pathMap.js. Así "Tu
  // ruta de hoy", Plan de 7 días y Misión comparten EXACTAMENTE la misma
  // forma, en vez de cada pantalla traer su propia copia del boceto.
  // Las 5 comidas del día ya registradas -- línea y nodos en dorado en
  // vez del verde/celeste de siempre, para celebrar el día completo
  // (pedido explícito de la usuaria, solo en esta pantalla).
  const allDone = menuItems.length > 0 && menuItems.every((it) => it.done);
  renderPathMap(menuCard.querySelector('#menu-path'), menuItems, { showLine: true, activeIndex: activeIndex === -1 ? undefined : activeIndex, allDone });
  menuHoy.forEach(({ meal, recipe }, i) => {
    const logBtn = menuCard.querySelector(`[data-row-idx="${i}"] .log-btn`);
    if (logBtn) logBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // El lápiz solo aparece cuando ya hay un registro real (ver
      // extraHtml más arriba: registro ? PENCIL_ICON : CAMERA_SOLID_ICON)
      // -- así que si está el lápiz, primero se muestra lo que de verdad
      // se registró (abrirComidaRegistrada), nunca se salta directo a
      // rehacer el registro desde cero. El botón principal de la fila
      // sigue abriendo la receta sugerida, sin tocar ese flujo.
      const registro = comidaRegistrada(meal.id);
      if (registro) {
        abrirComidaRegistrada(meal, registro, () => renderDashboard(clearAndGet(container)));
      } else {
        openMealLogModal(meal.id, meal.nombre, () => renderDashboard(clearAndGet(container)));
      }
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
    { icon: CART_ICON, label: t('Lista'), onTap: () => navigate('planner', { tab: 'compras' }) },
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
    const desbloqueados = state.logros.length;
    wrap.innerHTML = `<h2>🎖️ Logros</h2><div class="badges mt"></div>
      ${desbloqueados ? `<button type="button" class="btn ghost full mt" id="logros-compartir">${SHARE_ICON}Compartir mis logros</button>` : ''}`;
    const grid = wrap.querySelector('.badges');
    let ultimoDesbloqueado = null;
    for (const a of ACHIEVEMENTS) {
      const unlocked = state.logros.includes(a.id);
      if (unlocked) ultimoDesbloqueado = a;
      const b = document.createElement('div');
      b.className = 'badge' + (unlocked ? '' : ' locked');
      b.title = a.desc;
      b.innerHTML = `<div class="emoji">${a.emoji}</div><span class="small"><strong>${esc(a.nombre)}</strong></span>`;
      grid.appendChild(b);
    }
    wrap.querySelector('#logros-compartir')?.addEventListener('click', () => {
      abrirCompartirPlantillas({
        tipo: 'logro',
        titulo: 'Mis logros en NutriRuta',
        subtitulo: ultimoDesbloqueado ? `Último: ${ultimoDesbloqueado.nombre}` : '',
        valorGrande: `${desbloqueados}/${ACHIEVEMENTS.length}`,
        valorEtiqueta: 'logros desbloqueados',
        emoji: ultimoDesbloqueado?.emoji || '🎖️'
      });
    });
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
export const SEMAFORO_TEXTO = { verde: t('Apto para tu perfil'), amarillo: t('Modera esto'), rojo: t('Evita esto') };

// "Analizar con SuSana" en una receta del CATÁLOGO no necesita IA -- el
// semáforo ya salió de perfiles curados a mano (recipe.apto/moderar/
// evitar), así que la respuesta ya está definida, no hay nada que
// "pensar" ni tokens que gastar. El botón SIEMPRE abre un chat NUEVO
// (nunca continúa uno anterior) y muestra el resultado como tarjeta
// visual (barras + etiquetas, referencia real: Fitia Coach) -- para
// catálogo esta tarjeta se arma directo, sin llamar al servidor; solo
// una receta sin esa clasificación (propia, fuera de catálogo) sí
// amerita mandarla a analizar de verdad con la IA (ver el otro branch).
function analisisInstantaneo(light, recipe, user) {
  const perfilesMatch = recipe.apto.filter((p) => user.perfiles.includes(p)).map((p) => PROFILES[p].nombre);
  const nivel = light === 'verde' ? 'alto' : light === 'amarillo' ? 'medio' : 'bajo';
  const nutritivo = {
    alto: { rating: 'Óptimo', texto: `Excelente elección para tu perfil${perfilesMatch.length ? `, especialmente buena para ${perfilesMatch.join(', ')}` : ''}.` },
    medio: { rating: 'Modérala', texto: 'No es la mejor opción para tu perfil de salud, pero ocasionalmente está bien en una porción moderada.' },
    bajo: { rating: 'Evítala', texto: 'No es recomendable para tu perfil de salud actual. Mejor busca una alternativa.' }
  }[nivel];
  const integracion = {
    alto: { rating: 'Encaja bien', texto: 'Puedes comerla con confianza en tu rutina de hoy.' },
    medio: { rating: 'Con moderación', texto: 'Si la comes hoy, procura que sea en una porción pequeña.' },
    bajo: { rating: 'No ideal hoy', texto: 'Mejor no la incluyas en tu menú de hoy.' }
  }[nivel];
  const cierre = nivel === 'alto' ? '¿Quieres que hablemos de algo más de tu día?' : '¿Te ayudo a buscar una alternativa mejor?';
  return { nutritivo: { nivel, ...nutritivo }, integracion: { nivel, ...integracion }, cierre };
}

// Semáforo horizontal de verdad (3 luces), no solo un punto -- con la
// luz que corresponde encendida a color completo y las otras dos
// apagadas, pero SIN perder su color (rojo/amarillo/verde opacos, no
// gris) -- así se entiende que es un semáforo real, no solo un punto
// resaltado. Al lado de la etiqueta de texto, nunca reemplazándola.
export function semaforoIcon(light) {
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
// Mismos íconos ya definidos para cámara/voz/texto (app.js), a tamaño de
// texto en vez del tamaño de botón -- nunca un emoji genérico en su lugar.
// Los 3 traen width/height="24" fijos en el propio SVG (para su uso como
// botón), así que un span más chico alrededor no los reduce -- hay que
// reemplazar esos atributos, no solo envolver. icono+texto van en la MISMA
// fila flex (mismo patrón que CLOCK_ICON en openRecipe) para que el
// ícono quede alineado con el texto por align-items, no por vertical-align.
const iconoChico = (svg) => svg.replace('width="24" height="24"', 'width="14" height="14"');
const FUENTE_LABEL = {
  foto: () => ({ icono: iconoChico(CAMERA_SOLID_ICON), texto: t('Registrado por NutriCam') }),
  voz: () => ({ icono: iconoChico(MIC_ICON), texto: t('Registrado por voz') }),
  texto: () => ({ icono: iconoChico(TEXTO_ICON), texto: t('Registrado por texto') })
};
// Cada alimento registrado (foto/voz/texto libre) empieza con mayúscula,
// como cualquier frase -- "una tostada integral" detectado tal cual por
// la IA se veía en minúscula en el título y en la lista.
const capitalizar = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// Tarjeta de LO QUE DE VERDAD SE REGISTRÓ para una comida (foto/voz/texto),
// no la receta sugerida -- pedido explícito de la usuaria tras notar que
// el lápiz reabría el registro desde cero en vez de mostrar primero lo
// que ya había guardado (mismo criterio que Fitia: una vez hay un
// registro real, la app muestra ESO, no la sugerencia). Vive separada de
// openRecipe() porque un registro no es una receta -- alimentos en texto
// libre, sin ingredientes estructurados ni semáforo curado.
function abrirComidaRegistrada(meal, registro, onChange) {
  const { user } = getState();
  const light = trafficLightRecetaPropia({ ingredientes: registro.alimentos, descripcion: '' }, user.perfiles);
  openModal((modal, closeFn) => {
    const horaTexto = new Date(registro.hora).toLocaleTimeString(getIdioma() === 'en' ? 'en-US' : 'es', { hour: 'numeric', minute: '2-digit' });
    const fuente = (FUENTE_LABEL[registro.fuente] || (() => null))();
    const alimentosCap = registro.alimentos.map(capitalizar);
    // El título es lo que de verdad comiste (los alimentos registrados),
    // no el nombre de la estación ("Desayuno") -- eso ya se sabe por la
    // fila desde la que se abrió esta tarjeta, repetirlo era redundante.
    const tituloComida = alimentosCap.join(', ');
    modal.insertAdjacentHTML('beforeend', `
      <h2 class="center">${esc(tituloComida)}</h2>
      ${registro.fotoUrl
        ? `<img src="${registro.fotoUrl}" alt="${esc(tituloComida)}" class="mt" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;display:block">`
        : `<div class="center mt" style="font-size:2.4rem">${meal.emoji}</div>`}
      <p class="row mt" style="gap:8px;justify-content:center;align-items:center;flex-wrap:wrap">${semaforoIcon(light)}<span class="tag ${light}">${SEMAFORO_TEXTO[light] || light}</span></p>
      <p class="row small muted" style="justify-content:center;align-items:center;gap:6px;margin-top:2px">${fuente ? fuente.icono : ''}<span>${fuente ? fuente.texto + ' · ' : ''}${horaTexto}</span></p>
      <button type="button" class="btn-susana mt" id="cr-analizar-susana"><span class="susana-sparkle">${SPARKLE_ICON}</span> ${t('Analizar con SuSana')}</button>
      <h3 class="mt">${t('Ingredientes')}</h3>
      ${alimentosCap.map((a) => `<div class="ingredient">• ${esc(a)}</div>`).join('')}
      <button type="button" class="btn ghost full mt row" id="cr-editar" style="gap:6px;justify-content:center;align-items:center">${PENCIL_ICON}${t('Editar registro')}</button>
      <button type="button" class="btn danger full mt" id="cr-deshacer">🗑️ ${t('Deshacer registro')}</button>`);
    modal.querySelector('#cr-analizar-susana').addEventListener('click', () => {
      closeFn();
      // Misma ruta que el branch "sin apto" de openRecipe()/abrirRecetaPropia():
      // acá tampoco hay clasificación curada a mano, así que se analiza de
      // verdad con IA en vez de armar la tarjeta instantánea del catálogo.
      navigate('assistant', { nuevaConversacion: true, recetaNombre: t(meal.nombre), descripcionAnalisis: alimentosCap.join(', ') });
    });
    modal.querySelector('#cr-editar').addEventListener('click', () => {
      closeFn();
      openMealLogModal(meal.id, meal.nombre, onChange);
    });
    modal.querySelector('#cr-deshacer').addEventListener('click', () => {
      const deshacer = () => { borrarComidaRegistrada(meal.id); closeFn(); onChange?.(); };
      // Mismo aviso que ya existe en openRecipe() para el círculo "Comí
      // esto" -- nunca perder una foto en silencio (bug real ya ocurrido).
      if (registro.fotoUrl) {
        openModal((modalConfirmar, closeConfirmar) => {
          modalConfirmar.insertAdjacentHTML('beforeend', `
            <h2>${t('¿Deshacer este registro?')}</h2>
            <p class="mt">${t('Ya habías registrado esta comida con una foto -- deshacerlo la quita de Mi Diario.')}</p>`);
          const yes = document.createElement('button');
          yes.className = 'btn danger full mt';
          yes.textContent = t('Sí, deshacer');
          yes.addEventListener('click', () => { closeConfirmar(); deshacer(); });
          modalConfirmar.appendChild(yes);
        });
        return;
      }
      deshacer();
    });
  });
}

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
      <p class="row" style="gap:12px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:2px">
        ${recipe.tiempoMin ? `<span class="small muted row" style="gap:5px;align-items:center">${CLOCK_ICON}${recipe.tiempoMin} min</span>` : ''}
        <span class="row" style="gap:8px;align-items:center">${semaforoIcon(light)}<span class="tag ${light}">${SEMAFORO_TEXTO[light] || light}</span></span>
      </p>
      <p class="small mt center">${recipe.descripcion}</p>
      <p class="mt">${recipe.apto.filter((p) => user.perfiles.includes(p)).map((p) => `<span class="tag perfil">${PROFILES[p].nombre}</span>`).join(' ')}</p>
      <button type="button" class="btn-susana mt" id="rc-analizar-susana"><span class="susana-sparkle">${SPARKLE_ICON}</span> ${t('Analizar con SuSana')}</button>
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
        <div class="row ingredient-row" data-idx="${i}" style="gap:8px;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px dashed var(--border)">
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
    modal.querySelector('#rc-analizar-susana').addEventListener('click', () => {
      closeFn();
      // El botón SIEMPRE abre un chat NUEVO con SuSana (nunca continúa
      // uno anterior) y muestra el análisis como tarjeta visual (barras +
      // etiquetas, referencia real: Fitia Coach), no como texto plano.
      // Catálogo (recipe.apto/moderar/evitar ya definidos a mano) = el
      // semáforo ya ES el análisis: la tarjeta se arma directo, sin
      // gastar IA de verdad. Solo una receta SIN esa clasificación
      // (propia, fuera de catálogo) amerita mandarla a analizar de
      // verdad -- info fresca, recién pensada por la IA.
      if (Array.isArray(recipe.apto)) {
        navigate('assistant', {
          nuevaConversacion: true,
          instantCard: { recetaNombre: shown.nombre, ...analisisInstantaneo(light, recipe, user) }
        });
        return;
      }
      // Análisis real con IA (acción 'analyze' del servidor) para poder
      // pintarlo con la misma tarjeta visual que la instantánea de catálogo.
      // Se le manda la descripción y los ingredientes (editados por la
      // usuaria si los tocó), no solo el nombre -- el nombre solo no le
      // daba a la IA la misma información que ya usa trafficLightRecetaPropia()
      // para calcular el semáforo (ver menu.js), lo que podía hacer que
      // SuSana calificara bien algo que el semáforo de la app ya marcó mal.
      const descripcionAnalisis = `${shown.nombre}${recipe.descripcion ? `: ${recipe.descripcion}` : ''}${ingredientesTexto.length ? ` (Ingredientes: ${ingredientesTexto.join(', ')})` : ''}`;
      navigate('assistant', { nuevaConversacion: true, recetaNombre: shown.nombre, descripcionAnalisis });
    });
    modal.querySelector('#rc-agregar-ing').addEventListener('click', () => {
      ingredientesTexto.push('');
      pintarIngredientes();
      const filas = ingsWrap.querySelectorAll('.ing-edit');
      filas[filas.length - 1]?.click();
    });

    if (hoy) {
      const toggleBtn = modal.querySelector('#rc-check-toggle');
      const label = modal.querySelector('#rc-check-label');
      // El registro ORIGINAL con el que se abrió esta modal -- si venía
      // con foto (evidencia real, no una simple sugerencia), "deshacer"
      // NUNCA debe borrarlo en silencio. Bug real ya ocurrido: se perdió
      // la foto de un desayuno porque este círculo lo sobrescribió sin
      // avisar. Ahora pide confirmación explícita antes de tocar un
      // registro con foto.
      const teniaFotoAlAbrir = !!hoy.registro?.fotoUrl;
      const aplicarToggle = () => {
        registradoAhora = !registradoAhora;
        if (registradoAhora) guardarComidaRegistrada(hoy.mealId, ingredientesTexto.filter(Boolean), 'sugerencia');
        else borrarComidaRegistrada(hoy.mealId);
        toggleBtn.classList.toggle('done', registradoAhora);
        toggleBtn.textContent = registradoAhora ? '✓' : '';
        label.textContent = registradoAhora ? t('¡Comiste esto! Toca para deshacer') : t('¿Comiste esto?');
        hoy.onRegistrado?.();
      };
      toggleBtn.addEventListener('click', () => {
        if (registradoAhora && teniaFotoAlAbrir) {
          openModal((modalConfirmar, closeConfirmar) => {
            modalConfirmar.insertAdjacentHTML('beforeend', `
              <h2>${t('¿Deshacer este registro?')}</h2>
              <p class="mt">${t('Ya habías registrado esta comida con una foto -- deshacerlo la quita de Mi Diario.')}</p>`);
            const yes = document.createElement('button');
            yes.className = 'btn danger full mt';
            yes.textContent = t('Sí, deshacer');
            yes.addEventListener('click', () => { closeConfirmar(); aplicarToggle(); });
            modalConfirmar.appendChild(yes);
          });
          return;
        }
        aplicarToggle();
      });
    }
  });
}
