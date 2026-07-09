// Gráficas propias en SVG inline (sin CDN: la CSP de la app no permite
// scripts externos). Barras finas, esquinas redondeadas arriba, una sola
// línea de referencia tenue, un color por significado, números redondeados.

export function barChart(items, { height = 96, color = 'var(--primary)', suffix = '' } = {}) {
  const barW = 22;
  const gap = 14;
  const n = Math.max(1, items.length);
  const totalW = n * (barW + gap) + gap;
  const max = Math.max(1, ...items.map((i) => i.value));
  const baseY = height + 22;
  let bars = '';
  items.forEach((it, idx) => {
    const x = gap + idx * (barW + gap);
    const h = Math.max(2, Math.round((it.value / max) * height));
    const y = baseY - h;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="6" fill="${color}"/>`;
    bars += `<text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="10" fill="var(--ink)">${Math.round(it.value)}${suffix}</text>`;
    bars += `<text x="${x + barW / 2}" y="${baseY + 16}" text-anchor="middle" font-size="10" fill="var(--ink-soft)">${it.label}</text>`;
  });
  return `<svg viewBox="0 0 ${totalW} ${baseY + 24}" width="100%" height="${baseY + 24}" role="img"
      aria-label="Gráfico de barras" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="${baseY}" x2="${totalW}" y2="${baseY}" stroke="var(--ink-soft)" stroke-opacity="0.18" stroke-width="1"/>
    ${bars}
  </svg>`;
}

// Línea simple con puntos, para tendencias con pocos datos (p. ej. peso).
export function lineChart(items, { height = 90, color = 'var(--secondary)' } = {}) {
  if (!items.length) return '';
  const stepX = 46;
  const padX = 20;
  const totalW = padX * 2 + stepX * Math.max(1, items.length - 1);
  const values = items.map((i) => i.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = 18;
  const usableH = height - padY * 2;
  const points = items.map((it, idx) => {
    const x = padX + idx * stepX;
    const y = padY + usableH - ((it.value - min) / range) * usableH;
    return { x, y, label: it.label, value: it.value };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const dots = points.map((p) => `
    <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${color}"/>
    <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="10" fill="var(--ink)">${p.value}</text>
    <text x="${p.x}" y="${height + 14}" text-anchor="middle" font-size="9" fill="var(--ink-soft)">${p.label}</text>`).join('');
  return `<svg viewBox="0 0 ${totalW} ${height + 24}" width="100%" height="${height + 24}" role="img"
      aria-label="Gráfico de tendencia" xmlns="http://www.w3.org/2000/svg">
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>
    ${dots}
  </svg>`;
}
