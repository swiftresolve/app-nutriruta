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
const AMPLITUD = 17;
const PERIODO = 4.2;

// Íconos con arte real de la usuaria (recortada exacta de sus mockups de
// referencia, no un emoji ni un dibujo inventado) — solo cubre lo que ella
// envió. Todo lo demás sigue usando el emoji tal cual como antes.
const ICON_ASSETS = {
  '🍳': './assets/path-icons/desayuno.png',
};

export function renderPathMap(container, items, opts = {}) {
  const showLine = opts.showLine === true;
  const rowsHtml = items.map((it, i) => {
    const offset = AMPLITUD * Math.sin((i / PERIODO) * Math.PI * 2);
    const stateClass = it.done ? 'done' : it.now ? 'now' : it.locked ? 'locked' : '';
    const asset = !it.done && !it.locked ? ICON_ASSETS[it.icon] : null;
    const icon = it.done ? '✓' : (it.locked ? '🔒' : (asset ? `<img src="${asset}" alt="" class="path-node-icon-img">` : esc(it.icon)));
    const tag = it.now ? `<span class="path-tag path-tag-now">${esc(it.nowLabel || 'Actual')}</span>` : '';
    const mascot = it.now ? '<div class="path-mascot">🌿</div>' : '';
    // Burbuja con el título, apuntando hacia el círculo — solo en el nodo
    // "now", igual que en los mockups de referencia (los demás no la llevan).
    const bubble = it.now ? `<div class="path-bubble">${esc(it.title)}</div>` : '';
    return `<div class="path-row" data-row-idx="${i}" style="margin-left:${(22 + offset).toFixed(1)}%">
        <div class="path-node-col">
          ${mascot}
          ${bubble}
          <button type="button" class="path-node ${stateClass}" data-idx="${i}" aria-label="${esc(it.title)}"><span class="path-node-badge">${icon}</span></button>
        </div>
        <div class="path-label">
          <div class="path-t">${esc(it.title)}</div>
          ${it.subtitle ? `<div class="path-s">${esc(it.subtitle)}</div>` : ''}
          ${tag}
          ${it.extraHtml || ''}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `<div class="path-wrap${showLine ? '' : ' no-line'}"><svg class="path-svg"></svg>${rowsHtml}</div>`;
  if (showLine) drawCurve(container.querySelector('.path-wrap'));
  else container.querySelector('.path-svg').remove();

  items.forEach((it, i) => {
    if (!it.onClick) return;
    const el = container.querySelector(`.path-node[data-idx="${i}"]`);
    if (el) el.addEventListener('click', () => it.onClick(it, i));
  });
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
