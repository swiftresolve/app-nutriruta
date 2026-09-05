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

  container.innerHTML = `<div class="path-wrap${showLine ? '' : ' no-line'}"><svg class="path-svg"></svg>${rowsHtml}</div>`;
  if (showLine) drawCurve(container.querySelector('.path-wrap'));
  else container.querySelector('.path-svg').remove();
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
function drawCurve(wrap) {
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
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1], p1 = points[i];
    const midY = (p0.y + p1.y) / 2;
    d += ` C ${p0.x} ${midY}, ${p1.x} ${midY}, ${p1.x} ${p1.y}`;
  }
  svg.innerHTML = `<path d="${d}" fill="none" stroke="var(--primary-soft)" stroke-width="5" stroke-linecap="round"/>`;
}
