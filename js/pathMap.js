// Camino visual reutilizable, para cualquier lista secuencial de pasos
// (Misión 12 semanas, Plan de 7 días, menú del día). Los nodos se pintan en
// el flujo normal del documento — nunca en posiciones calculadas a ciegas —
// así una etiqueta más alta de lo normal (ej. el botón de cambiar receta)
// jamás se superpone con la fila siguiente. La curva que los conecta se
// traza DESPUÉS, midiendo el centro real de cada nodo ya pintado, por eso
// siempre coincide exactamente sin importar cuánto mida cada etiqueta.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Chulo de nodo completado -- grueso (nunca un "✓" de texto plano, que
// con la tipografía del sistema se veía casi invisible de lo delgado).
// Mismo café/ámbar oscuro que la estrella de la moneda de Duolingo que
// mostró la usuaria -- se ve nítido tanto contra el dorado como contra
// el verde de siempre, sin necesitar contorno ni sombra aparte.
const CHECK_ICON = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#8B5A1E" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M4 12.5l5 5L20 6"/></svg>`;

// items: [{ icon, title, subtitle, done, now, locked, nowLabel, onClick, extraHtml }]
// extraHtml: HTML adicional dentro de la etiqueta (ej. un botón de acción
// secundaria) — quien llama a renderPathMap puede engancharle sus propios
// listeners después, buscando `[data-idx="N"]` dentro del contenedor.
// opts.showLine (default false): el camino real de Duolingo no tiene una
// línea que una los círculos — la sensación de "recorrido curvo" la da
// solo el zigzag de .path-row/.right, no un trazo dibujado. Se dejó la
// opción por si alguna pantalla futura sí la necesita, pero Plan de 7
// días, Misión y menú del día van todos sin línea.
// Desplazamiento en onda (no zigzag): varios nodos seguidos se mueven en
// la misma dirección antes de invertir, como el camino real de Duolingo
// — no es "uno a la izquierda, uno a la derecha" (eso dibuja picos rectos
// en V), es una curva continua tipo seno. AMPLITUD = cuánto se aleja del
// centro; PERIODO = cuántos nodos entran en una vuelta completa de la onda.
// Amplitud reducida y período más largo -- con las filas más juntas (ver
// margin-bottom en .path-wrap.no-line .path-row), la amplitud anterior
// dejaba una pendiente muy pronunciada entre nodos consecutivos y la
// curva se veía como un zigzag brusco en vez de una onda suave.
// Negativo a propósito: con signo positivo el giro fuerte caía hacia la
// izquierda justo en el 5º nodo (ej. Cena en el menú del día) -- la
// usuaria pidió que el vaivén gire hacia la derecha ahí, así que se
// invierte el sentido de toda la onda (mismo período/amplitud, espejado).
const AMPLITUD = -11;
const PERIODO = 5.5;
// Pequeño corrimiento de fase: sin esto, el primer nodo (ej. Desayuno)
// cae exactamente en el centro (sin(0)=0) -- la usuaria pidió que los
// primeros 2 nodos se noten un poco más corridos hacia la derecha, para
// que la curva se note desde el principio.
const FASE = -0.06;

// Curva medida directamente del boceto real de la usuaria (9 puntos --
// 5 nodos + 4 intermedios -- no una fórmula de seno genérica). Debe verse
// EXACTAMENTE igual (mismos saltos entre puntos consecutivos, sin
// estirar ni comprimir la figura) en cualquier pantalla con línea
// animada -- menú del día, Plan de 7 días, Misión -- y para listas más
// largas que 5 pasos, esa misma figura se REPITE en ciclos idénticos.
const CURVA_BOCETO = [5, -13, -16, -11, 4, 14, 15, 13, 2];
const CURVA_RICH_FACTOR = 2; // puntos intermedios por cada tramo real
const CURVA_DELTAS = CURVA_BOCETO.slice(1).map((v, i) => v - CURVA_BOCETO[i]);

// Genera {offsets, curveShape} para CUALQUIER cantidad de nodos,
// repitiendo la misma secuencia de saltos del boceto en ciclos idénticos.
function curvaRepetida(nodeCount) {
  const totalRich = (nodeCount - 1) * CURVA_RICH_FACTOR + 1;
  let curveShape = [CURVA_BOCETO[0]];
  // El primer ciclo se queda tal cual (idéntico al boceto). SOLO la
  // segunda vuelta (nodos 5 a 7 en una lista de 7) se atenúa un poco --
  // no es una regla que se repita en cada ciclo siguiente, es puntual a
  // esa transición; de ahí en más (tercera vuelta, cuarta...) vuelve a la
  // fuerza normal.
  const DECAY = 0.55;
  for (let i = 1; i < totalRich; i++) {
    const ciclo = Math.floor((i - 1) / CURVA_DELTAS.length);
    const factor = ciclo === 1 ? DECAY : 1;
    curveShape.push(curveShape[i - 1] + CURVA_DELTAS[(i - 1) % CURVA_DELTAS.length] * factor);
  }
  // Nodo 4 y nodo 7 (Día 4 y Día 7 en Plan de 7 días) corridos muy
  // levemente a la derecha -- pedido puntual y ESPECÍFICO de esa lista de
  // 7 pasos, no una regla general para "más de 5 nodos" (eso colaba el
  // mismo ajuste en la Semana 7 de Misión, que es un nodo distinto en una
  // lista de 12, y se veía mal ahí).
  if (nodeCount === 7) {
    curveShape[6] += 3;
    curveShape[12] += 3;
  }
  // Semanas 1, 2 y 3 de Misión (nodos 0, 1 y 2, tramo 1) corridas a la
  // derecha TODAS JUNTAS.
  if (nodeCount === 12) {
    for (let k = 0; k <= 4; k++) curveShape[k] += 13;
  }
  // Semanas 4, 5 y 6 de Misión (nodos 3, 4 y 5, tramo 2) corridas a la
  // derecha TODAS JUNTAS por el mismo tanto -- mismo criterio que el
  // corrimiento de grupo del tramo 4 más abajo.
  if (nodeCount === 12) {
    for (let k = 6; k <= 10; k++) curveShape[k] += 6;
  }
  // Tramo 3 de Misión (Semanas 7-9, nodos 6-8) cae justo en la parte
  // atenuada de la segunda vuelta -- casi no se notaba la curva ahí. Se
  // le agrega más curvatura hacia la derecha, centrada en Semana 8 (el
  // punto intermedio), sin mover los nodos 6 y 8 de su lugar.
  if (nodeCount === 12) {
    curveShape[13] += 8;
    curveShape[14] += 14;
    curveShape[15] += 14;
  }
  // Tramo 3 completo (Semanas 7-9, nodos 6-8) corrido a la derecha TODO
  // JUNTO, encima de la curvatura de arriba.
  if (nodeCount === 12) {
    for (let k = 12; k <= 16; k++) curveShape[k] += 6;
  }
  // Nodo 9 (Semana 9) corrido un poco más a la derecha, puntual.
  if (nodeCount === 12) curveShape[16] += 5;
  // Semanas 10, 11 y 12 de Misión (nodos 9, 10 y 11) corridas a la
  // derecha TODAS JUNTAS por el mismo tanto -- un solo movimiento, no un
  // reacomodo de la curva entre ellas. Puntual a la lista de 12 semanas.
  if (nodeCount === 12) {
    for (let k = 18; k < curveShape.length; k++) curveShape[k] += 17;
  }
  // Recentrado: cada ciclo completo termina un poco más a la izquierda de
  // donde empezó (el boceto no es perfectamente simétrico), así que al
  // repetirlo varias veces el conjunto entero deriva hacia un lado en vez
  // de quedar centrado en la tarjeta. Se resta el promedio real para
  // balancearlo -- SOLO si no son 5 nodos, para no tocar en nada la curva
  // de "Tu ruta de hoy" (5 comidas) que ya quedó aprobada tal cual.
  if (nodeCount !== 5) {
    const promedio = curveShape.reduce((a, b) => a + b, 0) / curveShape.length;
    curveShape = curveShape.map((v) => v - promedio);
  }
  const offsets = [];
  for (let i = 0; i < nodeCount; i++) offsets.push(curveShape[i * CURVA_RICH_FACTOR]);
  return { offsets, curveShape };
}

export function renderPathMap(container, items, opts = {}) {
  const showLine = opts.showLine === true;
  // opts.offsets (PREVIEW): posiciones horizontales fijas a mano, en vez
  // de calcularlas con la onda de seno -- si showLine viene activo y no
  // se pasan offsets/curveShape explícitos, se generan solos repitiendo
  // el boceto real (ver curvaRepetida arriba), para que CUALQUIER
  // pantalla con línea (no solo "Tu ruta de hoy") use la misma curva.
  const curvaAuto = (showLine && !opts.offsets) ? curvaRepetida(items.length) : null;
  const offsets = opts.offsets || (curvaAuto && curvaAuto.offsets);
  // opts.allDone (PREVIEW): "Tu ruta de hoy" pinta nodos y línea en
  // dorado cuando las 5 comidas del día ya quedaron chuleadas -- pedido
  // puntual de esa pantalla, no cambia el look de Plan de 7 días ni
  // Misión (ninguna de las dos pasa este flag).
  const allDone = opts.allDone === true;
  const rowsHtml = items.map((it, i) => {
    const offset = offsets ? (offsets[i] ?? 0) : AMPLITUD * Math.sin((i / PERIODO + FASE) * Math.PI * 2);
    const stateClass = (it.done ? 'done' : it.now ? 'now' : it.locked ? 'locked' : '') + (allDone && it.done ? ' all-done' : '');
    // El "✓" de texto plano quedaba muy delgado con la tipografía del
    // sistema -- referencia real: el chulo grueso y beige de Duolingo.
    // Trazo grueso (stroke-width 4.5) en vez de un carácter de fuente.
    const icon = it.done ? CHECK_ICON : (it.locked ? '🔒' : esc(it.icon));
    const tag = it.now ? `<span class="path-tag path-tag-now">${esc(it.nowLabel || 'Actual')}</span>` : '';
    const mascot = it.now ? '<div class="path-mascot">🌿</div>' : '';
    return `<div class="path-row" data-row-idx="${i}" style="margin-left:${(22 + offset).toFixed(1)}%">
        <div class="path-node-col">
          ${mascot}
          <button type="button" class="path-node ${stateClass}" data-idx="${i}" aria-label="${esc(it.title)}">${icon}</button>
        </div>
        <div class="path-label">
          <div class="path-t-row"><div class="path-t">${esc(it.title)}</div>${tag}</div>
          ${it.subtitle ? `<div class="path-s">${esc(it.subtitle)}</div>` : ''}
          ${it.extraHtml || ''}
        </div>
      </div>`;
  }).join('');

  // El espaciado compacto (.no-line, 18px) sigue siendo el de siempre para
  // las pantallas sin línea (Plan de 7 días, Misión). "Tu ruta de hoy" sí
  // pidió línea animada -- y para que se note el tramo punteado entre
  // nodos, esa vista puntual usa un poco más de aire (.has-line), IGUAL
  // entre TODOS los nodos (la usuaria fue explícita: la distancia vertical
  // entre nodos debe ser exactamente la misma en toda la lista).
  const drawsLine = showLine || opts.activeIndex != null;
  // opts.rowGap (PREVIEW): Plan de 7 días y Misión no traen los botones
  // extra (cambiar/registrar) que sí tiene "Tu ruta de hoy" bajo cada
  // fila -- sin ese contenido, las filas quedan más bajas y el punteado
  // apenas se nota en algunos tramos. Solo esas pantallas piden más aire
  // vía esta variable; "Tu ruta de hoy" no la pasa y se queda con su
  // espaciado ya aprobado (18px).
  const gapStyle = opts.rowGap ? ` style="--path-gap:${opts.rowGap}px"` : '';
  container.innerHTML = `<div class="path-wrap no-line${drawsLine ? ' has-line' : ''}"${gapStyle}><svg class="path-svg"></svg>${rowsHtml}</div>`;
  if (!drawsLine) container.querySelector('.path-svg').remove();
  // Espaciado vertical parejo entre nodos: una etiqueta de 3 líneas (ej.
  // "Arma tu plato modelo, sin excusas") hace su fila más alta que una de
  // 1 línea, y con solo margin-bottom fijo la distancia entre CENTROS de
  // nodo terminaba siendo desigual (la fila más alta empujaba más la
  // siguiente). Se mide la altura real ya pintada de cada fila y se le da
  // a TODAS la del contenido más alto -- el nodo queda centrado dentro
  // (ver align-items:center en .path-row), así ninguna etiqueta larga se
  // superpone y la distancia entre nodos es siempre la misma.
  // Diferido a requestAnimationFrame: quien llama a renderPathMap arma el
  // contenedor en memoria y recién lo cuelga del documento DESPUÉS de esta
  // función retornar (ver dashboard.js/emergency.js/mission.js) -- medir
  // altura real ahora mismo daría 0 (elemento aún fuera del DOM). Para
  // cuando el navegador pinte el próximo frame, ya está insertado.
  // drawCurve va DESPUÉS de equalizeRowHeights, no antes -- drawCurve mide
  // la posición real ya pintada de cada nodo, y si corría primero (como
  // estaba) medía las filas ANTES de emparejar sus alturas; en cuanto
  // equalizeRowHeights las cambiaba, los nodos se corrían pero la curva ya
  // dibujada se quedaba en la posición vieja -- la línea no calzaba con
  // los nodos reales, sobre todo entre filas con subtítulos de distinto
  // largo.
  const drawOpts = curvaAuto ? { ...opts, curveShape: opts.curveShape || curvaAuto.curveShape } : opts;
  requestAnimationFrame(() => {
    equalizeRowHeights(container);
    if (drawsLine) drawCurve(container.querySelector('.path-wrap'), drawOpts);
  });

  items.forEach((it, i) => {
    if (!it.onClick) return;
    const el = container.querySelector(`.path-node[data-idx="${i}"]`);
    if (el) el.addEventListener('click', () => it.onClick(it, i));
  });
}

// Iguala la altura de todas las filas a la más alta ya renderizada (se
// resetea min-height antes de medir, si no la medición usaría el valor
// de una render anterior en vez de la altura natural real de esta lista).
function equalizeRowHeights(container) {
  const rows = Array.from(container.querySelectorAll('.path-row'));
  if (rows.length < 2) return;
  rows.forEach((r) => { r.style.minHeight = ''; });
  const maxH = Math.max(...rows.map((r) => r.getBoundingClientRect().height));
  rows.forEach((r) => { r.style.minHeight = `${maxH}px`; });
}

// Curva suave que pasa por el centro real (ya medido en pantalla) de cada
// nodo — nunca se calcula a ciegas, así que nunca se desalinea.
// opts.activeIndex (PREVIEW): índice del nodo "ahora". La línea completa
// (fondo tenue punteado) siempre muestra el recorrido del día entero. Sobre
// eso se dibuja, tramo por tramo (no como un solo trazo largo), el avance:
// los tramos entre nodos YA completados quedan en color sólido y quietos
// (esa parte del camino ya se cerró, no debe seguir "en progreso" para
// siempre), y solo el ÚLTIMO tramo -- el que lleva al nodo activo -- titila
// lento, que es el único que realmente está "en camino" ahora mismo.
// Catmull-Rom -> bezier genérico sobre CUALQUIER lista de puntos (no un
// punto de control a media altura): el punto de control de cada tramo se
// calcula mirando también al punto ANTERIOR y al SIGUIENTE, no solo los
// dos que conecta -- así la tangente coincide exactamente en cada punto y
// la curva se ve como un solo trazo fluido, sin "quiebres".
function catmullRomSegments(points) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const pPrev = points[i - 1] || points[i];
    const p0 = points[i];
    const p1 = points[i + 1];
    const pNext = points[i + 2] || p1;
    const c0 = { x: p0.x + (p1.x - pPrev.x) / 6, y: p0.y + (p1.y - pPrev.y) / 6 };
    const c1 = { x: p1.x - (pNext.x - p0.x) / 6, y: p1.y - (pNext.y - p0.y) / 6 };
    segments.push(`M ${p0.x} ${p0.y} C ${c0.x} ${c0.y}, ${c1.x} ${c1.y}, ${p1.x} ${p1.y}`);
  }
  return segments;
}

function drawCurve(wrap, opts = {}) {
  const svg = wrap.querySelector('.path-svg');
  const nodes = Array.from(wrap.querySelectorAll('.path-node'));
  if (nodes.length < 2) { svg.remove(); return; }
  const wrapRect = wrap.getBoundingClientRect();
  const points = nodes.map((n) => {
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2 - wrapRect.left, y: r.top + r.height / 2 - wrapRect.top };
  });
  svg.setAttribute('viewBox', `0 0 ${wrapRect.width} ${wrapRect.height}`);
  svg.setAttribute('width', wrapRect.width);
  svg.setAttribute('height', wrapRect.height);
  // opts.curveShape (PREVIEW): con un punto por nodo (5), cada tramo entre
  // dos nodos consecutivos queda casi recto en cuanto la curva real de la
  // usuaria se dobla MÁS de lo que un solo tramo de bezier entre esos dos
  // puntos puede reproducir -- la tangente en los nodos queda bien, pero
  // lo que pasa ENTRE ellos se aplana. opts.curveShape trae más puntos
  // (tomados del boceto real, uno por cada fracción de altura, no solo
  // uno por nodo) para que el trazo entre nodos siga la curva real, no
  // una versión simplificada de ella. richFactor = cuántos puntos extra
  // de curveShape caen POR CADA tramo real (curveShape.length - 1 debe
  // ser múltiplo de (points.length - 1)).
  let richPoints = points;
  let richFactor = 1;
  if (Array.isArray(opts.curveShape) && opts.curveShape.length > points.length) {
    const n = opts.curveShape.length;
    richFactor = (n - 1) / (points.length - 1);
    const nodeWidth = nodes[0].getBoundingClientRect().width;
    richPoints = opts.curveShape.map((offset, k) => {
      const t = k / (n - 1);
      const segIdx = Math.min(Math.floor(t * (points.length - 1)), points.length - 2);
      const localT = t * (points.length - 1) - segIdx;
      const y = points[segIdx].y + (points[segIdx + 1].y - points[segIdx].y) * localT;
      const x = (wrapRect.width * (22 + offset)) / 100 + nodeWidth / 2;
      return { x, y };
    });
  }
  // Un segmento (bezier) por cada PAR de puntos consecutivos de la curva
  // rica, no un solo trazo largo -- así cada TRAMO REAL (entre nodos) se
  // puede colorear/animar por separado agrupando sus `richFactor` piezas.
  const richSegments = catmullRomSegments(richPoints);
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const piece = richSegments.slice(i * richFactor, (i + 1) * richFactor);
    segments.push(`M ${richPoints[i * richFactor].x} ${richPoints[i * richFactor].y}` + piece.map((s) => s.slice(s.indexOf(' C'))).join(''));
  }
  // opts.skipSegments (PREVIEW): índices de tramo (0 = entre nodo 0 y 1,
  // etc.) donde NO debe haber línea -- Misión pide que el trazo se corte
  // por completo justo donde va un banner de "Tramo N" divisor, en vez de
  // pasar por debajo como si nada. Se cortan en runs (grupos de tramos
  // consecutivos SIN saltos) y cada run se dibuja como su propio <path>,
  // dejando un hueco real en la línea, no solo un cambio de color.
  const skip = new Set(opts.skipSegments || []);
  const runsDe = (indices) => {
    const runs = [];
    let actual = [];
    for (const i of indices) {
      if (skip.has(i)) { if (actual.length) runs.push(actual); actual = []; continue; }
      actual.push(i);
    }
    if (actual.length) runs.push(actual);
    return runs;
  };
  const pathDeRun = (run) => `M ${richPoints[run[0] * richFactor].x} ${richPoints[run[0] * richFactor].y}` +
    run.map((i) => richSegments.slice(i * richFactor, (i + 1) * richFactor).map((s) => s.slice(s.indexOf(' C'))).join('')).join('');
  const activeIndex = opts.activeIndex;
  const DASH = '6 11';
  if (opts.allDone) {
    // Las 5 comidas del día ya quedaron chuleadas -- la línea entera
    // sólida y dorada, sin punteado ni parpadeo (ya no hay ningún tramo
    // "en camino", el recorrido de hoy se cerró completo).
    const todosIdx = Array.from({ length: points.length - 1 }, (_, i) => i);
    const html = runsDe(todosIdx).map((run) => `<path d="${pathDeRun(run)}" fill="none" stroke="var(--yellow)" stroke-width="4.5" stroke-linecap="round"/>`).join('');
    svg.innerHTML = html;
    return;
  }
  if (activeIndex == null) {
    // "Tu ruta de hoy" pasa activeIndex indefinido cuando, según la hora
    // real y los horarios configurados por la usuaria, ninguna comida cae
    // "ahora" (ej. justo entre dos ventanas) -- antes esto caía a una
    // línea sólida vieja sin guiones, que se veía como un bug/diseño
    // distinto al resto. Mismo punteado tenue que el tramo "todavía no
    // llegado", nada más -- consistente siempre, haya o no comida activa.
    const todosIdx = Array.from({ length: points.length - 1 }, (_, i) => i);
    const html = runsDe(todosIdx).map((run) => `<path d="${pathDeRun(run)}" fill="none" stroke="var(--border)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${DASH}"/>`).join('');
    svg.innerHTML = html;
    return;
  }
  // Cada tramo se dibuja como su propio <path> (para poder colorear/animar
  // por separado), pero el patrón de guiones debe verse como UNA sola
  // línea continua de punta a punta -- si cada tramo reinicia su propio
  // stroke-dasharray desde cero, los guiones no calzan en la unión entre
  // tramos y se nota como líneas cortadas en vez de una curva. Se mide el
  // largo real (arco, no línea recta) de cada tramo ya pintado y se le da
  // a cada uno un stroke-dashoffset igual a la distancia acumulada desde
  // el primer nodo -- así el patrón "sigue corriendo" sin cortes.
  const measure = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.appendChild(measure);
  let acumulado = 0;
  const offsets = segments.map((s) => {
    const offset = acumulado;
    measure.setAttribute('d', s);
    acumulado += measure.getTotalLength();
    return offset;
  });
  svg.removeChild(measure);
  let overlayHtml = '';
  // Tramos 0..activeIndex-1 conectan nodos ya completados -- sólidos, sin
  // parpadeo. Solo el tramo (activeIndex-1 -> activeIndex) parpadea. Si
  // el tramo está en skipSegments (un banner divisor va justo ahí), no se
  // dibuja nada -- ni color ni gris, un hueco real en la línea.
  for (let i = 0; i < activeIndex; i++) {
    if (skip.has(i)) continue;
    const isUltimo = i === activeIndex - 1;
    overlayHtml += `<path class="${isUltimo ? 'path-progress' : ''}" d="${segments[i]}" fill="none" stroke="var(--primary)" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="${DASH}" stroke-dashoffset="${-offsets[i]}"/>`;
  }
  // El fondo tenue cubre los tramos futuros Y el tramo activo (el que se
  // está dibujando ahora) -- para los tramos YA completados (sólidos,
  // quietos) no lleva nada debajo, porque esos quedan 100% tapados por el
  // color y duplicar la línea ahí solo se asoma como un doble trazo feo
  // (bug real, ya corregido antes). Pero el tramo activo SÍ necesita el
  // gris debajo: mientras el color se revela punto por punto (ver el
  // clipPath más abajo), la parte todavía no revelada debe verse como una
  // guía gris ya existente, exactamente con la misma curva -- no vacío.
  const inicioFuturo = Math.max(0, activeIndex - 1);
  const futuroIdx = [];
  for (let i = inicioFuturo; i < segments.length; i++) futuroIdx.push(i);
  const futuroHtml = runsDe(futuroIdx).map((run) => `<path d="${pathDeRun(run)}" fill="none" stroke="var(--border)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${DASH}"/>`).join('');
  svg.innerHTML = `
    ${futuroHtml}
    ${overlayHtml}
  `;
  const progressPath = svg.querySelector('.path-progress');
  if (progressPath) {
    // Se traza de verdad, pedacito por pedacito, como si un lápiz lo
    // fuera dibujando -- y eso se repite EN LOOP sin parar (dibuja, se
    // mantiene un momento, se borra, vuelve a dibujarse), no una sola vez
    // seguida de un simple parpadeo de opacidad -- "siempre en camino".
    // Un rect en un clipPath propio de ESTE tramo (no de toda la ruta)
    // crece y decrece entre 0 y su alto real.
    const bbox = progressPath.getBBox();
    const clipId = `path-draw-clip-${Math.random().toString(36).slice(2, 9)}`;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fullH = bbox.height + 12;
    svg.insertAdjacentHTML('afterbegin', `
      <clipPath id="${clipId}">
        <rect class="path-draw-rect" x="${bbox.x - 6}" y="${bbox.y - 6}" width="${bbox.width + 12}" height="${reduceMotion ? fullH : 0}"/>
      </clipPath>
    `);
    progressPath.setAttribute('clip-path', `url(#${clipId})`);
    if (reduceMotion) {
      progressPath.style.animation = 'path-progress-pulse 2.2s ease-in-out infinite';
    } else {
      const rect = svg.querySelector('.path-draw-rect');
      const DIBUJAR_MS = 2900;
      // Nunca llega al 100% antes de reiniciar -- cualquier trazo que
      // "llega a su destino y se detiene" se siente como una llegada, sin
      // importar qué tan preciso sea el reinicio (ya se afinó todo lo que
      // se podía afinar ahí y seguía sintiéndose igual). En vez de eso,
      // se dibuja hasta el 93% y ahí mismo reinicia -- nunca se ve
      // "completo y quieto", siempre está en movimiento.
      const FRACCION = 0.93;
      const alturaObjetivo = fullH * FRACCION;
      const duracion = Math.round(DIBUJAR_MS * FRACCION);
      // Nunca se ve "retrocediendo" (el trazo encogiéndose de vuelta) --
      // eso se leía como que se estaba borrando. En vez de eso, al
      // terminar se resetea a 0 SIN transición (invisible de un frame a
      // otro) y arranca a dibujarse de nuevo desde cero, como si volviera
      // a empezar, no como si se deshiciera.
      const ciclo = () => {
        rect.style.transition = 'none';
        rect.setAttribute('height', '0');
        // Fuerza reflow para que el navegador no fusione este reseteo con
        // la animación de dibujo que sigue -- si no, a veces salta
        // directo al final en vez de animar desde 0.
        rect.getBoundingClientRect();
        requestAnimationFrame(() => {
          // "linear" a propósito -- con desaceleración al final (la curva
          // de antes) el último tramo se sentía como que "frenaba" justo
          // al llegar al nodo activo, como una pausa antes de reiniciar.
          rect.style.transition = `height ${duracion}ms linear`;
          rect.setAttribute('height', String(alturaObjetivo));
        });
      };
      // "transitionend" en vez de un setInterval con la misma duración --
      // un temporizador aparte nunca cae exactamente en el instante real
      // en que el navegador termina de pintar la transición (deriva por
      // el propio reflow/composición), y esa diferencia de unos cuantos
      // milisegundos se sentía como una pausa antes de reiniciar. Con el
      // evento real del navegador, el reinicio se dispara en el mismo
      // instante en que el trazo termina, sin espera de más.
      rect.addEventListener('transitionend', ciclo);
      ciclo();
    }
  }
}
