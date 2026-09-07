// Plantillas para compartir en redes sociales -- estilo scrapbook/collage
// (referencia real: capturas de Instagram que mandó la usuaria -- polaroids
// inclinados, cinta washi, texto manuscrito, notas de papel). Por ahora
// solo para Mi Diario (fotos de comidas); racha/peso/logros se hacen en
// otra pasada con su propio estilo. Todo se arma en el cliente con Canvas
// 2D (formato historia, 720x1280 = 9:16, listo para subir a redes) --
// nunca se sube ni se publica sola, solo se comparte o descarga lo que la
// usuaria decide compartir.
//
// content shape (por ahora solo 'diario'):
// { tipo: 'diario', titulo, subtitulo: string, fotos: string[] }
//
// Las 20 plantillas (10 claras + 10 oscuras) son variaciones de UNA misma
// composición (dibujarGenerica + LAYOUT_CANONICO) sobre 5 "familias" de
// marco (polaroid, polaroid+cinta, círculo, cuadrado bold, filmstrip) y su
// propia paleta -- así se logra variedad real sin 20 funciones de dibujo
// distintas. Solo las primeras 2 claras + 2 oscuras son gratis; el resto
// son Premium (ver plantillasDisponibles).
import { isPremium } from './store.js';

const W = 720, H = 1280;

// 4 fuentes para elegir (pedido explícito, no solo Caveat) -- cada una
// con su propia personalidad, autohospedadas por la CSP de la app
// (font-src 'self', ver @font-face en styles.css). "peso" real de cada
// una: Pacifico/Marcador/Ligera solo existen en weight 400, pedir 700 en
// esas no cargaría nada.
export const FUENTES_DISPONIBLES = [
  { id: 'caveat', nombre: 'Caveat', familia: 'Caveat, cursive', peso: '700' },
  { id: 'pacifico', nombre: 'Pacifico', familia: 'Pacifico, cursive', peso: '400' },
  { id: 'marcador', nombre: 'Marcador', familia: '"Permanent Marker", cursive', peso: '400' },
  { id: 'luz', nombre: 'Ligera', familia: '"Shadows Into Light", cursive', peso: '400' }
];
const FUENTE_DEFECTO = 'caveat';
function fuenteInfo(fuenteId) {
  return FUENTES_DISPONIBLES.find((f) => f.id === fuenteId) || FUENTES_DISPONIBLES.find((f) => f.id === FUENTE_DEFECTO);
}

// Canvas no espera solo a que un @font-face esté declarado en CSS -- si
// se dibuja texto antes de que el archivo termine de descargar, sale en
// la fuente por defecto (letra "normal", sin nada de personalidad) y ya
// no se vuelve a redibujar solo. Hay que esperar el load() de verdad
// antes de cualquier fillText con esa fuente -- una vez por familia, no
// una vez por plantilla.
const fontsCargadas = new Set();
async function asegurarFuente(familia) {
  if (fontsCargadas.has(familia)) return;
  try { await document.fonts.load(`400 64px ${familia}`); } catch { /* si falla igual se sigue con la fuente de respaldo del navegador */ }
  try { await document.fonts.load(`700 64px ${familia}`); } catch { /* algunas de estas 4 fuentes no tienen peso 700 -- no es un error real */ }
  fontsCargadas.add(familia);
}

function cargarImagen(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar una foto.'));
    img.src = url;
  });
}

// Foto recortada a cuadrado (centro-crop) dentro de un rectángulo ya
// posicionado -- la usan todos los estilos de marco.
function dibujarFotoCuadrada(ctx, img, x, y, size) {
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, x, y, size, size);
}

// ===== Estilos de marco =====

// Polaroid real: borde blanco parejo a los lados/arriba, más grueso abajo
// (la "etiqueta" a mano), sombra suave, rotado sobre su propio centro --
// se ven como fotos sueltas tiradas en la mesa, no una grilla ordenada.
function dibujarPolaroid(ctx, img, cx, cy, fotoSize, rotDeg, { borde = 16, bordeInferior = 64 } = {}) {
  const w = fotoSize + borde * 2;
  const h = fotoSize + borde + bordeInferior;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = 'transparent';
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w / 2 + borde, -h / 2 + borde, fotoSize, fotoSize);
    ctx.clip();
    dibujarFotoCuadrada(ctx, img, -w / 2 + borde, -h / 2 + borde, fotoSize);
    ctx.restore();
  } else {
    ctx.fillStyle = '#EDE6DC';
    ctx.fillRect(-w / 2 + borde, -h / 2 + borde, fotoSize, fotoSize);
  }
  ctx.restore();
}

// Foto circular con un anillo de color -- variante más suave/orgánica que
// el polaroid, sin rotación (no aplica a un círculo).
function dibujarCirculo(ctx, img, cx, cy, size, colorAnillo) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 + 10, 0, Math.PI * 2);
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = colorAnillo;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (img) dibujarFotoCuadrada(ctx, img, cx - size / 2, cy - size / 2, size);
  else { ctx.fillStyle = '#EDE6DC'; ctx.fillRect(cx - size / 2, cy - size / 2, size, size); }
  ctx.restore();
}

// Foto cuadrada "bold": borde delgado parejo (no polaroid), plana y
// directa -- la versión "de un solo golpe de color" para las plantillas
// más gráficas/geométricas.
function dibujarCuadrado(ctx, img, cx, cy, size, rotDeg, colorBorde) {
  const m = 10;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = colorBorde;
  ctx.fillRect(-size / 2 - m, -size / 2 - m, size + m * 2, size + m * 2);
  ctx.shadowColor = 'transparent';
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-size / 2, -size / 2, size, size);
    ctx.clip();
    dibujarFotoCuadrada(ctx, img, -size / 2, -size / 2, size);
    ctx.restore();
  }
  ctx.restore();
}

// Cinta washi: franja semitransparente rotada, sobre la esquina de una
// foto ya puesta -- para que se note que es cinta y no un rectángulo de
// color suelto.
function dibujarCinta(ctx, cx, cy, w, h, rotDeg, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Camino de un rectángulo con los bordes IZQUIERDO y DERECHO rasgados
// (arriba/abajo rectos, como el corte parejo de un rollo real) -- pedido
// explícito: "como arrancada en los extremos, no con cortes perfectos".
// Un rectángulo liso se ve como una etiqueta de diseño, no como cinta de
// verdad arrancada a mano.
function pathRasgado(ctx, w, h, dientes = 5, amp = 6) {
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  for (let i = 1; i <= dientes; i++) {
    const y = -h / 2 + (h * i) / dientes;
    const x = w / 2 + (i % 2 === 0 ? amp : -amp);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(-w / 2, h / 2);
  for (let i = 1; i <= dientes; i++) {
    const y = h / 2 - (h * i) / dientes;
    const x = -w / 2 + (i % 2 === 0 ? amp : -amp);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Título "pegado con cinta de enmascarar" -- pedido explícito: en vez de
// texto suelto flotando sobre la foto de fondo, una franja beige/blanca
// clara (como cinta real, con los extremos rasgados) detrás, con el
// título escrito encima en tinta oscura. La tinta es SIEMPRE oscura acá
// (no el colorTitulo de cada plantilla) porque la cinta es clara sin
// importar el tema -- un título blanco encima se perdería igual que en
// una cinta real.
function dibujarTituloCinta(ctx, texto, cx, cy, fuente) {
  ctx.font = fuente;
  const anchoTexto = ctx.measureText(texto).width;
  const padX = 36, altoCinta = 76;
  const anchoCinta = Math.min(anchoTexto + padX * 2, W - 30);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-1.5 * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = 'rgba(238,228,204,0.95)';
  pathRasgado(ctx, anchoCinta, altoCinta);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#3D2B24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, 0, 4);
  ctx.restore();
}

// Nota de papel rasgada con una frase corta -- referencia real (varias de
// las capturas que mandó la usuaria tienen estas notitas sueltas tipo
// "Good food Great vibes ♡" al lado de una foto). Reusa pathRasgado, pero
// más angosta y con texto normal (no manuscrito) en vez del título.
function dibujarNotaPapel(ctx, texto, cx, cy, colorPapel, colorTexto, fuenteId, rotDeg = -3) {
  const F = fuenteInfo(fuenteId);
  ctx.font = `600 26px ${F.familia}`;
  const anchoTexto = ctx.measureText(texto).width;
  const padX = 22, alto = 52;
  const ancho = Math.min(anchoTexto + padX * 2, 300);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = colorPapel;
  pathRasgado(ctx, ancho, alto, 3, 4);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = colorTexto;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, 0, 2);
  ctx.restore();
}

// Pedacito de cinta washi con borde rasgado (reusa pathRasgado) -- pedido
// explícito: "pedacitos de cinta pegados en los bordes de las fotos".
// Distinta de dibujarCinta (esa sigue siendo el par de cintas en las
// esquinas de la familia "cinta"): esta es UNA sola tira arriba de la
// foto, para las plantillas que no tienen ya su propia cinta.
function dibujarCintaBorde(ctx, cx, cy, w, h, rotDeg, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = color;
  pathRasgado(ctx, w, h, 3, 4);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ===== Stickers/doodles (corazón, destello, trazos, flecha) =====
// Pedido explícito, referencia real: acentos dibujados a mano en las
// esquinas libres de la plantilla -- nunca se ponen encima de fotos,
// título o pie de marca, solo en el espacio vacío alrededor.
function dibujarCorazon(ctx, cx, cy, size, color, rotDeg = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.6);
  ctx.bezierCurveTo(-s * 1.3, -s * 0.3, -s * 0.5, -s * 1.2, 0, -s * 0.4);
  ctx.bezierCurveTo(s * 0.5, -s * 1.2, s * 1.3, -s * 0.3, 0, s * 0.6);
  ctx.stroke();
  ctx.restore();
}
function dibujarDestello(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s * 0.15, -s * 0.15, s, 0);
  ctx.quadraticCurveTo(s * 0.15, s * 0.15, 0, s);
  ctx.quadraticCurveTo(-s * 0.15, s * 0.15, -s, 0);
  ctx.quadraticCurveTo(-s * 0.15, -s * 0.15, 0, -s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function dibujarTrazos(ctx, cx, cy, size, color, rotDeg = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * size * 0.35, -size / 2);
    ctx.lineTo(i * size * 0.35, size / 2);
    ctx.stroke();
  }
  ctx.restore();
}
function dibujarFlecha(ctx, cx, cy, size, color, rotDeg = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.05);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-size / 2, -size / 3);
  ctx.quadraticCurveTo(size / 4, -size / 2, size / 2, size / 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size / 2 - size * 0.22, size / 3 - size * 0.05);
  ctx.lineTo(size / 2, size / 3);
  ctx.lineTo(size / 2 - size * 0.05, size / 3 - size * 0.25);
  ctx.stroke();
  ctx.restore();
}
// Motor alterno: usa la imagen de referencia REAL (las capturas que
// mandó la usuaria, guardadas en img/share-templates/) como fondo
// completo, e inserta la foto de la usuaria exactamente en el "hueco"
// donde esa referencia ya tenía una foto -- pedido explícito: "en las
// imagenes de referencia esta todo, solo debes hacer caso a lo que te
// digo" / "deben ser esas mismas". Todo lo demás de la captura (cinta,
// stickers, notas, textura de fondo) es la imagen real, sin redibujar.
// cfg.huecos: posición de cada hueco en FRACCIÓN (0-1) del ancho/alto de
// la propia imagen de referencia (no del canvas) -- se recalcula según
// el tamaño real que ocupe esa imagen al hacer cover-fit sobre el 9:16.
async function dibujarConFondoReal(ctx, content, cfg) {
  const bg = await cargarImagen(cfg.fondoImagen);
  const escala = Math.max(W / bg.width, H / bg.height);
  const w = bg.width * escala, h = bg.height * escala;
  const offX = (W - w) / 2, offY = (H - h) / 2;
  ctx.drawImage(bg, offX, offY, w, h);

  const fotos = await cargarFotos(content.fotos, cfg.huecos.length);
  fotos.forEach((img, i) => {
    if (!img) return;
    const hueco = cfg.huecos[i];
    const hx = offX + hueco.x * w, hy = offY + hueco.y * h;
    const hw = hueco.w * w, hh = hueco.h * h;
    ctx.save();
    ctx.translate(hx + hw / 2, hy + hh / 2);
    ctx.rotate(((hueco.rot ?? 0) * Math.PI) / 180);
    ctx.beginPath();
    // Algunas referencias (ej. círculos sobre fondo tostado) recortan la
    // foto en círculo, no en rectángulo -- si no se respeta esa forma,
    // la foto nueva se sale del marco redondo original.
    if (hueco.forma === 'circulo') ctx.ellipse(0, 0, hw / 2, hh / 2, 0, 0, Math.PI * 2);
    else ctx.rect(-hw / 2, -hh / 2, hw, hh);
    ctx.clip();
    const s = Math.max(hw / img.width, hh / img.height);
    const fw = img.width * s, fh = img.height * s;
    ctx.drawImage(img, -fw / 2, -fh / 2, fw, fh);
    ctx.restore();
  });

  // "Ubicar la foto y ponerle encima el marco blanco": en vez de perseguir
  // a ojo la posición exacta del borde de cada polaroid (siempre queda
  // algo chueco), se redibuja encima la máscara de blancos de la propia
  // referencia -- así el marco/cinta/texto blanco original vuelve a
  // quedar nítido sin importar el tamaño/encuadre real de cada hueco.
  if (cfg.lineaEncima) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = bg.width; maskCanvas.height = bg.height;
    const mctx = maskCanvas.getContext('2d');
    mctx.drawImage(bg, 0, 0);
    const maskData = mctx.getImageData(0, 0, bg.width, bg.height);
    const md = maskData.data;
    for (let p = 0; p < md.length; p += 4) {
      if (md[p] > 222 && md[p + 1] > 222 && md[p + 2] > 222) md[p + 3] = 255;
      else md[p + 3] = 0;
    }
    mctx.putImageData(maskData, 0, 0);
    ctx.drawImage(maskCanvas, offX, offY, w, h);
  }
}

// Detecta por inundación (flood fill) la forma real de una "pieza" en la
// imagen de referencia, partiendo de un punto semilla dentro de ella y
// usando la línea blanca (zigzag o rompecabezas) como pared que no se
// cruza. Devuelve una máscara pixel a pixel (no un rectángulo) + su caja
// delimitadora -- así la foto del usuario se puede recortar con la forma
// exacta de la pieza, incluyendo los "dientes" que se meten en la pieza
// vecina, en vez de quedar como un rectángulo chico flotando adentro.
function calcularMascaraPieza(data, W, H, seedXFrac, seedYFrac, umbral = 220) {
  const sx = Math.min(W - 1, Math.max(0, Math.round(seedXFrac * W)));
  const sy = Math.min(H - 1, Math.max(0, Math.round(seedYFrac * H)));
  const esBarrera = (x, y) => {
    const i = (y * W + x) * 4;
    return data[i] > umbral && data[i + 1] > umbral && data[i + 2] > umbral;
  };
  const mask = new Uint8Array(W * H);
  if (esBarrera(sx, sy)) return { mask, minX: sx, maxX: sx, minY: sy, maxY: sy };
  const stack = [[sx, sy]];
  mask[sy * W + sx] = 1;
  let minX = sx, maxX = sx, minY = sy, maxY = sy;
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    const vecinos = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of vecinos) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const idx = ny * W + nx;
      if (mask[idx] || esBarrera(nx, ny)) continue;
      mask[idx] = 1;
      stack.push([nx, ny]);
    }
  }
  return { mask, minX, maxX, minY, maxY };
}

// "Rompecabezas real": cada foto del usuario rellena por completo la
// forma real de su pieza (rompecabezas o grilla con línea zigzag), no un
// rectángulo aproximado adentro -- y la línea blanca original se vuelve a
// dibujar encima al final para que la división entre piezas quede siempre
// nítida sin importar el tamaño/recorte de cada foto. cfg.piezas: array
// de { seed: [xFrac, yFrac] } -- un punto que caiga dentro de esa pieza en
// la imagen de referencia (no necesita ser el centro exacto).
async function dibujarRompecabezas(ctx, content, cfg) {
  const bg = await cargarImagen(cfg.fondoImagen);
  const bw = bg.width, bh = bg.height;
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = bw; bgCanvas.height = bh;
  const bgCtx = bgCanvas.getContext('2d');
  bgCtx.drawImage(bg, 0, 0);
  const bgData = bgCtx.getImageData(0, 0, bw, bh);

  const escala = Math.max(W / bw, H / bh);
  const w = bw * escala, h = bh * escala;
  const offX = (W - w) / 2, offY = (H - h) / 2;

  const fotos = await cargarFotos(content.fotos, cfg.piezas.length);

  const piezasCanvas = document.createElement('canvas');
  piezasCanvas.width = bw; piezasCanvas.height = bh;
  const pCtx = piezasCanvas.getContext('2d');
  pCtx.drawImage(bg, 0, 0); // base: si faltan fotos, esa pieza queda con la foto original

  cfg.piezas.forEach((pieza, i) => {
    const img = fotos[i];
    if (!img) return;
    const resultado = calcularMascaraPieza(bgData.data, bw, bh, pieza.seed[0], pieza.seed[1]);
    const { mask } = resultado;
    let { minX, maxX, minY, maxY } = resultado;
    // banda: para plantillas donde varias fotos comparten una misma
    // "mitad" delimitada por la línea (ej. el zigzag vertical de la
    // grilla, sin línea horizontal real entre filas) -- recorta la
    // máscara a una franja vertical [y0,y1] para separar esas fotos,
    // conservando el borde real (la línea) en los lados que sí la tienen.
    if (pieza.banda) {
      const [b0, b1] = pieza.banda;
      const y0 = Math.round(b0 * bh), y1 = Math.round(b1 * bh);
      minX = bw; maxX = 0; minY = bh; maxY = 0;
      for (let y = 0; y < bh; y++) {
        const dentro = y >= y0 && y < y1;
        for (let x = 0; x < bw; x++) {
          const idx = y * bw + x;
          if (!mask[idx]) continue;
          if (!dentro) { mask[idx] = 0; continue; }
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    const pw = maxX - minX, ph = maxY - minY;
    if (pw <= 0 || ph <= 0) return;
    const capa = document.createElement('canvas');
    capa.width = bw; capa.height = bh;
    const capaCtx = capa.getContext('2d');
    const s = Math.max(pw / img.width, ph / img.height);
    const fw = img.width * s, fh = img.height * s;
    capaCtx.drawImage(img, minX + pw / 2 - fw / 2, minY + ph / 2 - fh / 2, fw, fh);
    const capaData = capaCtx.getImageData(0, 0, bw, bh);
    const cd = capaData.data;
    for (let p = 0; p < mask.length; p++) {
      if (!mask[p]) cd[p * 4 + 3] = 0;
    }
    capaCtx.putImageData(capaData, 0, 0);
    pCtx.drawImage(capa, 0, 0);
  });

  ctx.drawImage(piezasCanvas, offX, offY, w, h);

  const lineaData = bgCtx.getImageData(0, 0, bw, bh);
  const ld = lineaData.data;
  for (let p = 0; p < ld.length; p += 4) {
    if (ld[p] > 222 && ld[p + 1] > 222 && ld[p + 2] > 222) ld[p + 3] = 255;
    else ld[p + 3] = 0;
  }
  bgCtx.putImageData(lineaData, 0, 0);
  ctx.drawImage(bgCanvas, offX, offY, w, h);
}

// Set fijo de 4 acentos en las esquinas libres -- no depende de dónde
// caigan las fotos porque las 4 esquinas del canvas siempre están vacías
// (las fotos/círculos se centran, dejan margen a los lados). Si la
// plantilla ya tiene firma (ej. "xoxo") en la esquina inferior derecha,
// esa esquina se salta para no encimarlos.
function dibujarDoodles(ctx, cfg) {
  const color = cfg.colorAcento === '#FFFFFF' ? (cfg.colorTitulo || cfg.colorMarca) : cfg.colorAcento;
  dibujarCorazon(ctx, 65, 235, 58, color, -12);
  dibujarDestello(ctx, W - 65, 225, 46, color);
  dibujarTrazos(ctx, 60, H - 270, 60, color, -20);
  // Flechita curva delgada, como dibujada a mano -- pedido explícito,
  // referencia real (las notas de "sweet treat"/"chill sips" en DANBRO
  // señalan la foto con una flecha así).
  dibujarFlecha(ctx, W - 140, H - 340, 70, color, 25);
  if (!cfg.firma) dibujarDestello(ctx, W - 60, H - 260, 42, color);
}

// Carrete/filmstrip: una foto grande a la izquierda + una tira blanca
// vertical de fotos chicas a la derecha, como un carrete de fotomatón.
// Con 1 sola foto no hay nada que meter en la tira, así que se centra
// grande en su lugar.
function dibujarFilmstrip(ctx, fotos, colorTira) {
  if (fotos.length <= 1) {
    if (fotos[0]) dibujarPolaroid(ctx, fotos[0], W / 2, 660, 420, -2);
    return;
  }
  if (fotos[0]) dibujarPolaroid(ctx, fotos[0], W / 2 - 130, 640, 320, -3);
  const tiraX = W / 2 + 170, tiraAncho = 170, marco = 10, fotoTira = tiraAncho - marco * 2;
  const chicas = fotos.slice(1, 4);
  const altoTira = chicas.length * (fotoTira + marco * 2) + marco;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = colorTira;
  ctx.fillRect(tiraX - tiraAncho / 2, 340, tiraAncho, altoTira);
  ctx.shadowColor = 'transparent';
  chicas.forEach((img, i) => {
    const y = 340 + marco + i * (fotoTira + marco * 2);
    if (img) dibujarFotoCuadrada(ctx, img, tiraX - tiraAncho / 2 + marco, y, fotoTira);
    else { ctx.fillStyle = '#EDE6DC'; ctx.fillRect(tiraX - tiraAncho / 2 + marco, y, fotoTira, fotoTira); }
  });
  ctx.restore();
}

// Texto manuscrito con una leve rotación propia -- nunca perfectamente
// horizontal, como si estuviera escrito a mano encima de la foto.
function dibujarTextoManuscrito(ctx, texto, cx, cy, { fuente, color, rotDeg = -2, align = 'center' } = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.font = fuente;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(texto, 0, 0);
  ctx.restore();
}

function dibujarMarca(ctx, color) {
  const logoSize = 30, logoGap = 10;
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  const textoMarca = 'NutriRuta';
  const anchoTexto = ctx.measureText(textoMarca).width;
  const anchoGrupo = logoSize + logoGap + anchoTexto;
  const inicioX = W / 2 - anchoGrupo / 2;
  const textY = H - 40;
  return cargarImagen('./icons/icon-192.png').then((logo) => {
    ctx.drawImage(logo, inicioX, textY - logoSize / 2 - 6, logoSize, logoSize);
    ctx.fillText(textoMarca, inicioX + logoSize + logoGap, textY);
  }).catch(() => {
    ctx.textAlign = 'center';
    ctx.fillText(textoMarca, W / 2, textY);
  });
}

// Carga hasta n fotos reales; si alguna falla, esa posición queda con el
// placeholder gris del marco correspondiente en vez de romper toda la
// imagen por una sola foto corrupta.
async function cargarFotos(urls, n) {
  const lista = urls.slice(0, n);
  return Promise.all(lista.map((u) => cargarImagen(u).catch(() => null)));
}

// Composición pensada para 3 fotos (la que se ve en las referencias) --
// pero la usuaria puede compartir desde una sola comida del día, así que
// hay una posición centrada propia para 1 y 2 fotos, no solo para 3.
// Misma disposición para las 20 plantillas (con o sin cinta encima según
// la familia): la variedad real está en la paleta y el marco, no en
// reinventar el layout 20 veces.
const LAYOUT_CANONICO = {
  1: [{ x: W / 2, y: 680, size: 480, rot: -2 }],
  2: [
    { x: W / 2 - 100, y: 580, size: 400, rot: -6 },
    { x: W / 2 + 130, y: 890, size: 360, rot: 5 }
  ],
  3: [
    { x: W / 2 - 100, y: 500, size: 340, rot: -7 },
    { x: W / 2 + 130, y: 760, size: 310, rot: 5 },
    { x: W / 2 - 150, y: 950, size: 290, rot: -4 }
  ]
};
// Layout propio para el marco "círculo" -- más grandes que el genérico, y
// a propósito puestos para que se toquen apenas entre sí (pedido
// explícito: "que estén uno sobre otro, muy levemente, solo una
// partecita"). La distancia entre centros queda un poco por debajo de la
// suma de los radios -- así se superponen solo un borde, no la mitad.
// Cascada diagonal (aprobada) -- solo un poco más grande y todo el grupo
// corrido más arriba que la primera versión, pedido explícito.
const LAYOUT_CIRCULOS = {
  1: [{ x: W / 2, y: 600, size: 650 }],
  2: [
    { x: W / 2 - 90, y: 520, size: 525 },
    { x: W / 2 + 100, y: 860, size: 470 }
  ],
  3: [
    { x: W / 2 - 90, y: 370, size: 460 },
    { x: W / 2 + 100, y: 630, size: 420 },
    { x: W / 2 - 110, y: 880, size: 395 }
  ]
};
function layoutPara(n, marco) {
  const tabla = marco === 'circulo' ? LAYOUT_CIRCULOS : LAYOUT_CANONICO;
  return tabla[Math.min(n, 3)] || tabla[3];
}

// Fondo = la misma foto real que subió la usuaria, ocupando el 9:16
// completo de la plantilla -- pedido explícito: "debe ocupar toda la
// pantalla perfectamente en el fondo", sin bordes de color arriba/abajo.
// Va a "cover" (recorta lo que sobre para llenar el marco entero, no
// "contain"), con el tinte de la plantilla encima como una capa de
// opacidad para que el texto se siga leyendo.
async function dibujarFondoFoto(ctx, urlFoto, cfg) {
  const img = await cargarImagen(urlFoto).catch(() => null);
  if (img) {
    const escala = Math.max(W / img.width, H / img.height);
    const ancho = img.width * escala, alto = img.height * escala;
    ctx.drawImage(img, (W - ancho) / 2, (H - alto) / 2, ancho, alto);
  } else {
    ctx.fillStyle = cfg.fondo.tinte;
    ctx.fillRect(0, 0, W, H);
  }

  // +0.1 fijo sobre lo que traiga cada plantilla -- pedido explícito de
  // subir un poco la opacidad del tinte en todas a la vez, sin tener que
  // tocar el valor de cada una de las 18 plantillas por separado (las
  // oscuras se quedan más oscuras que las claras igual, se respeta la
  // diferencia relativa entre ellas).
  ctx.fillStyle = cfg.fondo.tinte;
  ctx.globalAlpha = Math.min((cfg.fondo.lavado ?? 0.16) + 0.1, 0.6);
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  const g = ctx.createLinearGradient(0, H - 360, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, cfg.fondo.sombraInferior ?? 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 360, W, 360);
}

// ===== Motor genérico: TODAS las plantillas pasan por acá =====
async function dibujarGenerica(ctx, content, cfg, fuenteId) {
  const esFotoFondo = cfg.fondo.tipo === 'foto-usuario';
  if (esFotoFondo) {
    await dibujarFondoFoto(ctx, content.fotos[0], cfg);
  } else if (cfg.fondo.tipo === 'solido') {
    ctx.fillStyle = cfg.fondo.color;
    ctx.fillRect(0, 0, W, H);
  } else if (cfg.fondo.tipo === 'gradiente-v') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    cfg.fondo.paradas.forEach(([pos, color]) => g.addColorStop(pos, color));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createRadialGradient(W / 2, cfg.fondo.cy ?? 500, 50, W / 2, cfg.fondo.cy ?? 500, cfg.fondo.r ?? 750);
    cfg.fondo.paradas.forEach(([pos, color]) => g.addColorStop(pos, color));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const F = fuenteInfo(fuenteId);
  await asegurarFuente(F.familia);
  const fuenteTitulo = `${F.peso} ${cfg.fuenteTitulo}px ${F.familia}`;
  const fuenteSubtitulo = `${F.peso} ${cfg.fuenteSubtitulo}px ${F.familia}`;
  // El título va "pegado con cinta" (pedido explícito, referencia real:
  // captura de un post con tags de cinta/papel) -- una franja clara
  // detrás del texto, en vez de texto suelto flotando sobre la foto. Va
  // SIEMPRE en tinta oscura sobre la cinta, sin importar el colorTitulo
  // de la plantilla (una cinta clara con texto claro encima no se leería).
  dibujarTituloCinta(ctx, content.titulo, W / 2, cfg.tituloY ?? 130, fuenteTitulo);

  // Sobre una foto real (no un color plano predecible), el subtítulo/firma
  // sí quedan flotando directo sobre la foto -- necesitan su propia
  // sombra para seguir leyéndose sin importar qué tan clara u oscura
  // salga esa zona.
  if (esFotoFondo) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; }

  // TODAS las fotos seleccionadas van arriba en polaroid/círculo/cuadrado,
  // se use o no una de ellas también como fondo -- pedido explícito: el
  // fondo no le "quita" una foto a las que se ven encima, es un uso
  // aparte de la primera foto, no un reemplazo.
  const fotos = await cargarFotos(content.fotos, cfg.marco === 'filmstrip' ? 4 : 3);

  if (cfg.marco === 'filmstrip') {
    dibujarFilmstrip(ctx, fotos, cfg.colorAcento);
  } else {
    const slots = layoutPara(fotos.length, cfg.marco);
    fotos.forEach((img, i) => {
      const s = slots[i];
      if (cfg.cinta) {
        dibujarCinta(ctx, s.x - s.size * 0.28, s.y - s.size / 2 - s.size * 0.08, 90, 32, (s.rot ?? 0) - 25, cfg.cinta);
        dibujarCinta(ctx, s.x + s.size * 0.28, s.y - s.size / 2 - s.size * 0.08, 90, 32, (s.rot ?? 0) + 25, cfg.cinta);
      }
      if (cfg.marco === 'circulo') dibujarCirculo(ctx, img, s.x, s.y, s.size, cfg.colorAcento);
      else if (cfg.marco === 'cuadrado') dibujarCuadrado(ctx, img, s.x, s.y, s.size, s.rot, cfg.colorAcento);
      else {
        dibujarPolaroid(ctx, img, s.x, s.y, s.size, s.rot);
        // Pedacito de cinta justo sobre el borde de la foto -- pedido
        // explícito: "como si pegaras la foto con la cinta", centrada en
        // la línea del borde (mitad sobre la foto, mitad afuera) en vez
        // de flotando separada arriba. Solo si esta plantilla no tiene ya
        // su propia cinta en las esquinas (cfg.cinta).
        if (!cfg.cinta) {
          dibujarCintaBorde(ctx, s.x + (i % 2 === 0 ? -s.size * 0.15 : s.size * 0.15), s.y - s.size / 2, 90, 34, (s.rot ?? 0) + (i % 2 === 0 ? -9 : 9), cfg.colorAcento);
        }
      }
    });
  }

  ctx.shadowColor = 'transparent';
  dibujarDoodles(ctx, cfg);

  // Notas de papel sueltas (referencia real: varias capturas traen
  // notitas cortas al lado de una foto, ej. "Good food Great vibes ♡") --
  // cfg.notas es una lista de {texto,x,y,rot} propia de cada plantilla.
  if (cfg.notas) {
    cfg.notas.forEach((n) => {
      dibujarNotaPapel(ctx, n.texto, n.x, n.y, cfg.notaPapel || 'rgba(255,255,255,0.94)', cfg.notaTexto || '#3D2B24', fuenteId, n.rot ?? -3);
    });
  }

  if (content.subtitulo) {
    if (esFotoFondo) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; }
    dibujarTextoManuscrito(ctx, content.subtitulo, W / 2, 1095, { fuente: fuenteSubtitulo, color: cfg.colorSubtitulo, rotDeg: 2 });
  }
  if (cfg.firma) {
    if (esFotoFondo) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; }
    dibujarTextoManuscrito(ctx, cfg.firma, W - 90, H - 130, { fuente: `${F.peso} 46px ${F.familia}`, color: cfg.colorTitulo, rotDeg: -6, align: 'right' });
  }
  ctx.shadowColor = 'transparent';
  await dibujarMarca(ctx, esFotoFondo ? '#FFFFFF' : cfg.colorMarca);
}

// ===== Las 20 plantillas (10 claras + 10 oscuras) =====
// Inspiradas en capturas reales de Instagram que mandó la usuaria
// (polaroids, cinta washi, texto manuscrito, carrete de fotomatón, notas
// de papel). No son copias pixel a pixel -- es el mismo lenguaje visual
// recreado con formas propias en Canvas. Las primeras 2 claras + 2
// oscuras son gratis; el resto son Premium (ver plantillasDisponibles).
// Ya no arman el string de fuente completo (eso depende de cuál de las 4
// fuentes elija la usuaria, ver FUENTES_DISPONIBLES) -- solo guardan el
// tamaño en px; dibujarGenerica arma el font-string real al momento de
// dibujar, combinando este tamaño con la fuente elegida.
const FUENTE = (px) => px;
const FUENTE_SUB = (px) => px;

export const TEMPLATES = [
  // ----- Claras -----
  {
    // "Fondo real" (ver dibujarConFondoReal): la captura tal cual, las
    // fotos de la usuaria se insertan en los mismos huecos donde esa
    // captura ya tenía una foto.
    id: 'polaroid-claro', nombre: 'Qué día tan lindo', tema: 'claro', premium: true,
    fondoImagen: './img/share-templates/ref01-curtain.jpg',
    // lineaEncima: en vez de perseguir a ojo el tamaño exacto del marco
    // blanco (siempre queda un poco chueco), el hueco se hace un poco más
    // grande de lo necesario y el marco/texto blanco original se redibuja
    // encima al final -- así siempre tapa cualquier borde de la foto que
    // se pase, sin importar el encuadre real de cada polaroid.
    lineaEncima: true,
    huecos: [
      { x: 0.49, y: 0.04, w: 0.36, h: 0.31, rot: 13 },
      { x: 0.02, y: 0.53, w: 0.43, h: 0.32, rot: -1 },
      { x: 0.13, y: 0.69, w: 0.76, h: 0.30, rot: -1 }
    ]
  },
  {
    id: 'cinta-rosa', nombre: 'Domingo y chill', tema: 'claro', premium: true,
    fondoImagen: './img/share-templates/ref02-sakura.jpg',
    lineaEncima: true,
    huecos: [
      { x: 0.08, y: 0.045, w: 0.35, h: 0.185, rot: -8 },
      { x: 0.555, y: 0.045, w: 0.35, h: 0.16, rot: 17 },
      { x: 0.26, y: 0.73, w: 0.50, h: 0.22, rot: 10 }
    ]
  },
  {
    id: 'circulo-menta', nombre: 'Rincón de café', tema: 'claro', premium: true,
    fondoImagen: './img/share-templates/ref09-circles-tan.jpg',
    huecos: [
      { x: 0.028, y: 0.008, w: 0.465, h: 0.270, forma: 'circulo' },
      { x: 0.535, y: 0.168, w: 0.465, h: 0.316, forma: 'circulo' },
      { x: 0.368, y: 0.746, w: 0.632, h: 0.254, forma: 'circulo' }
    ]
  },
  {
    id: 'cuadrado-mostaza', nombre: 'Sobre lo de ayer', tema: 'claro', premium: true,
    fondoImagen: './img/share-templates/ref04-doodle.jpg',
    // Rompecabezas real (ver dibujarRompecabezas): la línea zigzag
    // vertical SÍ es una pared continua de punta a punta (no hay línea
    // horizontal real entre filas, son fotos pegadas directo) -- por eso
    // cada pieza usa "banda" para recortar su fila dentro de la mitad
    // izquierda/derecha que sí delimita el zigzag real.
    piezas: [
      { seed: [0.15, 0.58], banda: [0.39, 0.663] },
      { seed: [0.62, 0.48], banda: [0.39, 0.663] },
      { seed: [0.72, 0.87], banda: [0.663, 1] }
    ]
  },
  {
    id: 'filmstrip-crema', nombre: 'Buena comida, buenas vibras', tema: 'claro', premium: true,
    fondoImagen: './img/share-templates/ref06-lifelately.jpg',
    // Cuadrícula real de 4 -- cada foto rellena su cuarto completo, sin
    // márgenes (antes dejaban un borde del fondo original asomando).
    huecos: [
      { x: 0, y: 0, w: 0.5, h: 0.5, rot: 0 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5, rot: 0 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5, rot: 0 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rot: 0 }
    ]
  },
  {
    id: 'cinta-lavanda', nombre: 'Cinta lavanda', tema: 'claro', premium: false,
    fondo: { tipo: 'foto-usuario', tinte: '#6E5A8C', lavado: 0.16, sombraInferior: 'rgba(28,18,40,0.55)' },
    marco: 'polaroid', cinta: '#D9C6F0', colorAcento: '#D9C6F0',
    colorTitulo: '#5B3F82', colorSubtitulo: '#6E5A8C', colorMarca: '#6E5A8C',
    fuenteTitulo: FUENTE(62), fuenteSubtitulo: FUENTE_SUB(32), firma: '✨'
  },
  {
    id: 'circulo-durazno', nombre: 'Círculos durazno', tema: 'claro', premium: false,
    fondo: { tipo: 'foto-usuario', tinte: '#E8845C', lavado: 0.16, sombraInferior: 'rgba(50,24,10,0.5)' },
    marco: 'circulo', cinta: null, colorAcento: '#FFFFFF',
    colorTitulo: '#B5552E', colorSubtitulo: '#A3745C', colorMarca: '#A3745C',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: null
  },
  {
    id: 'cuadrado-cielo', nombre: 'Antojo del tiny café', tema: 'claro', premium: true,
    fondoImagen: './img/share-templates/ref07-banner.jpg',
    huecos: [
      { x: 0, y: 0, w: 0.5, h: 0.5, rot: 0 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5, rot: 0 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5, rot: 0 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rot: 0 }
    ]
  },
  {
    id: 'polaroid-terracota', nombre: 'Cita en el café', tema: 'claro', premium: true,
    fondoImagen: './img/share-templates/ref05-cream-notes.jpg',
    lineaEncima: true,
    huecos: [
      { x: 0.02, y: 0.03, w: 0.52, h: 0.44, rot: -3 },
      { x: 0.04, y: 0.49, w: 0.48, h: 0.42, rot: -2 },
      { x: 0.56, y: 0.175, w: 0.42, h: 0.39, rot: 2 }
    ]
  },
  {
    id: 'cinta-menta', nombre: 'Diario de antojos', tema: 'claro', premium: true,
    fondoImagen: './img/share-templates/ref11-cream-scrap.jpg',
    lineaEncima: true,
    huecos: [
      { x: 0.02, y: 0.01, w: 0.59, h: 0.45, rot: -2 },
      { x: 0.33, y: 0.42, w: 0.66, h: 0.47, rot: -3 },
      { x: 0, y: 0.755, w: 0.335, h: 0.245, rot: 0 }
    ]
  },
  // ----- Oscuras -----
  {
    id: 'cafe-oscuro', nombre: 'Café', tema: 'oscuro', premium: false,
    fondo: { tipo: 'foto-usuario', tinte: '#1A1410', lavado: 0.3, sombraInferior: 'rgba(6,3,0,0.6)' },
    marco: 'polaroid', cinta: null, colorAcento: '#E3B65E',
    colorTitulo: '#E3B65E', colorSubtitulo: '#D8C9B8', colorMarca: '#D8C9B8',
    fuenteTitulo: FUENTE(70), fuenteSubtitulo: FUENTE_SUB(32), firma: null,
    tituloY: 140
  },
  {
    id: 'carrete-oscuro', nombre: 'Mi vida últimamente', tema: 'oscuro', premium: true,
    fondoImagen: './img/share-templates/ref15-puzzle.jpg',
    // Rompecabezas real (ver dibujarRompecabezas): las 4 fotos de la
    // usuaria rellenan la forma completa de su pieza -- no un rectángulo
    // chico adentro -- y la línea blanca original se redibuja encima al
    // final para que la división quede siempre nítida.
    piezas: [
      { seed: [0.25, 0.35] },
      { seed: [0.78, 0.32] },
      { seed: [0.15, 0.80] },
      { seed: [0.78, 0.78] }
    ]
  },
  {
    id: 'circulo-esmeralda', nombre: 'Rico 😊', tema: 'oscuro', premium: true,
    fondoImagen: './img/share-templates/ref14-cafevibes.jpg',
    lineaEncima: true,
    huecos: [
      { x: 0.014, y: 0.160, w: 0.493, h: 0.320, rot: -1 },
      { x: 0.521, y: 0.031, w: 0.479, h: 0.441, rot: 1 },
      { x: 0, y: 0.496, w: 0.75, h: 0.504, rot: 0 }
    ]
  },
  {
    id: 'cuadrado-carbon', nombre: 'Salida del día', tema: 'oscuro', premium: true,
    fondoImagen: './img/share-templates/ref16-blurredcafe.jpg',
    lineaEncima: true,
    huecos: [
      { x: 0.17, y: 0.155, w: 0.58, h: 0.34, rot: -1 },
      { x: 0.25, y: 0.50, w: 0.62, h: 0.36, rot: 2 }
    ]
  },
  {
    id: 'cinta-vino', nombre: 'Vibras de café', tema: 'oscuro', premium: true,
    fondoImagen: './img/share-templates/ref12-green-notes.jpg',
    lineaEncima: true,
    huecos: [
      { x: 0.56, y: 0.03, w: 0.44, h: 0.40, rot: 2 },
      { x: 0, y: 0.23, w: 0.45, h: 0.47, rot: -2 },
      { x: 0.41, y: 0.60, w: 0.59, h: 0.38, rot: 2 }
    ]
  },
  {
    id: 'polaroid-medianoche', nombre: 'Ese momento', tema: 'oscuro', premium: true,
    fondoImagen: './img/share-templates/ref08-dimmed.jpg',
    huecos: [
      { x: 0, y: 0.20, w: 0.5, h: 0.335, rot: 0 },
      { x: 0.5, y: 0.20, w: 0.5, h: 0.335, rot: 0 },
      { x: 0, y: 0.535, w: 0.5, h: 0.295, rot: 0 },
      { x: 0.5, y: 0.535, w: 0.5, h: 0.295, rot: 0 }
    ]
  },
  {
    id: 'circulo-ciruela', nombre: 'Momentos así', tema: 'oscuro', premium: true,
    fondoImagen: './img/share-templates/ref10-cafedate.jpg',
    lineaEncima: true,
    huecos: [
      { x: 0.07, y: 0.04, w: 0.42, h: 0.45, rot: -3 },
      { x: 0.55, y: 0.14, w: 0.44, h: 0.45, rot: 3 },
      { x: 0.11, y: 0.40, w: 0.44, h: 0.44, rot: -2 }
    ]
  },
  {
    // "Fondo real": la captura DANBRO tal cual (ver dibujarConFondoReal) --
    // las 3 fotos de la usuaria se insertan en los mismos 3 huecos donde
    // esa captura ya tenía una foto; cinta, stickers, texto y textura de
    // papel rayado son la imagen real, sin redibujar.
    id: 'cuadrado-bosque', nombre: 'Momento café', tema: 'claro', premium: true,
    fondoImagen: './img/share-templates/ref13-danbro.jpg',
    huecos: [
      { x: 0.10, y: 0.125, w: 0.76, h: 0.25, rot: -1.5 },
      { x: 0.13, y: 0.395, w: 0.75, h: 0.255, rot: 1.5 },
      { x: 0.10, y: 0.66, w: 0.78, h: 0.24, rot: -0.5 }
    ]
  },
  {
    id: 'filmstrip-negro', nombre: 'Nunca es tarde para lo nuestro', tema: 'oscuro', premium: true,
    fondoImagen: './img/share-templates/ref03-grid.jpg',
    huecos: [
      { x: 0, y: 0, w: 1, h: 0.333, rot: 0 },
      { x: 0, y: 0.333, w: 1, h: 0.334, rot: 0 },
      { x: 0, y: 0.667, w: 1, h: 0.333, rot: 0 }
    ]
  },
  {
    id: 'cinta-cobre', nombre: 'Cinta cobre', tema: 'oscuro', premium: false,
    fondo: { tipo: 'foto-usuario', tinte: '#241A14', lavado: 0.3, sombraInferior: 'rgba(14,8,4,0.65)' },
    marco: 'polaroid', cinta: '#C98554', colorAcento: '#C98554',
    colorTitulo: '#E8B98C', colorSubtitulo: '#C9A88F', colorMarca: '#C9A88F',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: null
  }
].map((cfg) => ({
  ...cfg,
  // Si trae fondoImagen, es una plantilla "fondo real" (ver
  // dibujarConFondoReal) -- usa la captura de referencia tal cual en vez
  // de la composición genérica.
  dibujar: (ctx, content, fuenteId) => {
    if (cfg.piezas) return dibujarRompecabezas(ctx, content, cfg);
    if (cfg.fondoImagen) return dibujarConFondoReal(ctx, content, cfg);
    return dibujarGenerica(ctx, content, cfg, fuenteId);
  }
}));

async function dibujarPlantilla(tpl, content, fuenteId) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  await tpl.dibujar(ctx, content, fuenteId);
  return canvas;
}

export async function generarImagen(tpl, content, fuenteId) {
  const canvas = await dibujarPlantilla(tpl, content, fuenteId);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

export async function generarPreviewURL(tpl, content, fuenteId) {
  const canvas = await dibujarPlantilla(tpl, content, fuenteId);
  return canvas.toDataURL('image/jpeg', 0.75);
}

// Cuáles plantillas puede usar de verdad la usuaria hoy -- toda la lista
// se sigue mostrando en el carrusel (para que sepa que existen e inviten
// a subir a Premium), pero solo se generan/comparten las que no están
// bloqueadas.
export function plantillasDisponibles() {
  const premium = isPremium();
  return TEMPLATES.map((t) => ({ ...t, bloqueada: t.premium && !premium }));
}
