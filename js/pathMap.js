// Camino visual reutilizable: línea + nodos alternados, para cualquier lista
// secuencial de pasos (Misión 12 semanas, Plan de 7 días). Los nodos y la
// línea se calculan con las mismas coordenadas (un ancho de referencia de
// 340, expresado en % para que escale igual que el SVG en cualquier ancho
// real de pantalla), así nunca se desalinean.
const ROW_H = 108;
const REF_W = 340;
const X_LEFT = 60;
const X_RIGHT = 280;
const pct = (x) => (x / REF_W * 100).toFixed(3);

function svgPathD(n) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const x = i % 2 === 0 ? X_LEFT : X_RIGHT;
    const y = ROW_H / 2 + i * ROW_H;
    if (i === 0) { d += `M ${x} ${y}`; continue; }
    const px = (i - 1) % 2 === 0 ? X_LEFT : X_RIGHT;
    const py = ROW_H / 2 + (i - 1) * ROW_H;
    const midY = (py + y) / 2;
    d += ` C ${px} ${midY}, ${x} ${midY}, ${x} ${y}`;
  }
  return d;
}

// items: [{ icon, title, subtitle, done, now, locked, nowLabel, onClick, extraHtml }]
// extraHtml: HTML adicional dentro de la etiqueta (ej. un botón de acción
// secundaria) — quien llama a renderPathMap puede engancharle sus propios
// listeners después, buscando `[data-idx="N"]` dentro del contenedor.
export function renderPathMap(container, items) {
  const totalH = items.length * ROW_H;
  const svg = `<svg class="path-svg" viewBox="0 0 340 ${totalH}" preserveAspectRatio="none">
    <path d="${svgPathD(items.length)}" fill="none" stroke="var(--primary-soft)" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 14"/>
  </svg>`;

  const nodesHtml = items.map((it, i) => {
    const isLeft = i % 2 === 0;
    const x = isLeft ? X_LEFT : X_RIGHT;
    const y = ROW_H / 2 + i * ROW_H;
    const posStyle = isLeft
      ? `left: calc(${pct(x)}% - 29px); top:${y - 29}px;`
      : `right: calc(${pct(REF_W - x)}% - 29px); top:${y - 29}px;`;
    const mascot = it.now
      ? `<div class="path-mascot" style="top:${y - 58}px; ${isLeft ? `left: calc(${pct(x)}% - 14px)` : `right: calc(${pct(REF_W - x)}% - 44px)`}">🌿</div>`
      : '';
    const stateClass = it.done ? 'done' : it.now ? 'now' : it.locked ? 'locked' : '';
    const icon = it.done ? '✓' : (it.locked ? '🔒' : it.icon);
    const tag = it.now ? `<span class="path-tag path-tag-now">${it.nowLabel || 'Actual'}</span>` : '';
    return `<div class="path-node-wrap ${isLeft ? '' : 'right'}" style="${posStyle}" data-wrap-idx="${i}">
        <button type="button" class="path-node ${stateClass}" data-idx="${i}" aria-label="${it.title}">${icon}</button>
        <div class="path-label">
          <div class="path-t">${it.title}</div>
          ${it.subtitle ? `<div class="path-s">${it.subtitle}</div>` : ''}
          ${tag}
          ${it.extraHtml || ''}
        </div>
      </div>${mascot}`;
  }).join('');

  container.innerHTML = `<div class="path-wrap" style="height:${totalH}px">${svg}${nodesHtml}</div>`;

  items.forEach((it, i) => {
    if (!it.onClick) return;
    const el = container.querySelector(`.path-node[data-idx="${i}"]`);
    if (el) el.addEventListener('click', () => it.onClick(it, i));
  });
}
