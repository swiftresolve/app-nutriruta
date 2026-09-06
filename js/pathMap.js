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

export function renderPathMap(container, items, opts = {}) {
  const showLine = opts.showLine === true;
  const rowsHtml = items.map((it, i) => {
    const offset = AMPLITUD * Math.sin((i / PERIODO + FASE) * Math.PI * 2);
    const stateClass = it.done ? 'done' : it.now ? 'now' : it.locked ? 'locked' : '';
    const icon = it.done ? '✓' : (it.locked ? '🔒' : esc(it.icon));
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
  container.innerHTML = `<div class="path-wrap no-line${drawsLine ? ' has-line' : ''}"><svg class="path-svg"></svg>${rowsHtml}</div>`;
  if (drawsLine) {
    // PREVIEW -- opts.activeIndex (índice del nodo "now") activa el trazo
    // punteado animado: un fondo tenue con el recorrido completo, y un
    // trazo de color que se dibuja solo hasta la comida actual y queda
    // titilando ahí (referencia real de la usuaria: "estás aquí, en
    // camino" en vez de una línea fija). Sin activeIndex, se comporta
    // igual que antes (línea sólida fija).
    drawCurve(container.querySelector('.path-wrap'), opts);
  } else {
    container.querySelector('.path-svg').remove();
  }
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
  requestAnimationFrame(() => equalizeRowHeights(container));

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
  // Un segmento (bezier) por cada PAR de nodos consecutivos, no un solo
  // trazo largo -- así cada tramo se puede colorear/animar por separado.
  // Catmull-Rom -> bezier (no un punto de control a media altura): el
  // punto de control de cada tramo se calcula mirando también al nodo
  // ANTERIOR y al SIGUIENTE, no solo los dos que conecta -- así la
  // tangente coincide exactamente en cada nodo y la curva se ve como un
  // solo trazo fluido, sin "quiebres" donde el zigzag (AMPLITUD/PERIODO)
  // cambia de dirección (antes cada tramo se calculaba aislado y en esos
  // puntos la línea se notaba como dos trazos distintos, no uno continuo).
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
  const fullD = `M ${points[0].x} ${points[0].y}` + segments.map((s) => s.slice(s.indexOf(' C'))).join('');
  const activeIndex = opts.activeIndex;
  const DASH = '6 11';
  if (activeIndex == null) {
    // "Tu ruta de hoy" pasa activeIndex indefinido cuando, según la hora
    // real y los horarios configurados por la usuaria, ninguna comida cae
    // "ahora" (ej. justo entre dos ventanas) -- antes esto caía a una
    // línea sólida vieja sin guiones, que se veía como un bug/diseño
    // distinto al resto. Mismo punteado tenue que el tramo "todavía no
    // llegado", nada más -- consistente siempre, haya o no comida activa.
    svg.innerHTML = `<path d="${fullD}" fill="none" stroke="var(--border)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${DASH}"/>`;
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
  // parpadeo. Solo el tramo (activeIndex-1 -> activeIndex) parpadea.
  for (let i = 0; i < activeIndex; i++) {
    const isUltimo = i === activeIndex - 1;
    overlayHtml += `<path class="${isUltimo ? 'path-progress' : ''}" d="${segments[i]}" fill="none" stroke="var(--primary)" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="${DASH}" stroke-dashoffset="${-offsets[i]}"/>`;
  }
  svg.innerHTML = `
    <path d="${fullD}" fill="none" stroke="var(--border)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${DASH}"/>
    ${overlayHtml}
  `;
  const progressPath = svg.querySelector('.path-progress');
  if (progressPath) {
    // Aparece con un fundido corto y de ahí en más queda titilando lento
    // -- "estás en camino" solo en el tramo que de verdad está activo.
    progressPath.style.opacity = '0';
    requestAnimationFrame(() => {
      progressPath.style.transition = 'opacity 0.6s ease';
      progressPath.style.opacity = '1';
      progressPath.style.animation = 'path-progress-pulse 2.2s ease-in-out 0.6s infinite';
    });
  }
}
