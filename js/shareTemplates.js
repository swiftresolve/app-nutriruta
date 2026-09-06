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
  ctx.lineWidth = Math.max(2, size * 0.08);
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

  // Con fondo=foto de la usuaria, esa primera foto YA es el fondo -- las
  // que se overlayan en polaroid/círculo/cuadrado son las demás
  // seleccionadas (o la misma, si solo eligió una).
  const fotosParaOverlay = esFotoFondo && content.fotos.length > 1 ? content.fotos.slice(1) : content.fotos;
  const fotos = await cargarFotos(fotosParaOverlay, cfg.marco === 'filmstrip' ? 4 : 3);

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
    id: 'polaroid-claro', nombre: 'Polaroid', tema: 'claro', premium: true,
    fondo: { tipo: 'gradiente-v', paradas: [[0, '#FFFDF9'], [1, '#FFF3E8']] },
    marco: 'polaroid', cinta: null, colorAcento: '#FBD9C7',
    colorTitulo: '#B5552E', colorSubtitulo: '#8C6F63', colorMarca: '#B99788',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(34), firma: 'xoxo'
  },
  {
    id: 'cinta-rosa', nombre: 'Cinta rosa', tema: 'claro', premium: true,
    fondo: { tipo: 'solido', color: '#FBD9E5' },
    marco: 'polaroid', cinta: '#F7C6D9', colorAcento: '#F7C6D9',
    colorTitulo: '#7A3B54', colorSubtitulo: '#7A3B54', colorMarca: '#A85C79',
    fuenteTitulo: FUENTE(62), fuenteSubtitulo: FUENTE_SUB(32), firma: null
  },
  {
    id: 'circulo-menta', nombre: 'Círculos menta', tema: 'claro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#1F6B4A', lavado: 0.14, sombraInferior: 'rgba(10,30,20,0.55)' },
    marco: 'circulo', cinta: null, colorAcento: '#FFFFFF',
    colorTitulo: '#1F6B4A', colorSubtitulo: '#4E8067', colorMarca: '#4E8067',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: '🌿'
  },
  {
    id: 'cuadrado-mostaza', nombre: 'Bold mostaza', tema: 'claro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#B8860B', lavado: 0.16, sombraInferior: 'rgba(40,28,4,0.55)' },
    marco: 'cuadrado', cinta: null, colorAcento: '#FFFFFF',
    colorTitulo: '#7A4E1D', colorSubtitulo: '#8C6F3F', colorMarca: '#8C6F3F',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: null
  },
  {
    id: 'filmstrip-crema', nombre: 'Carrete crema', tema: 'claro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#8C7B65', lavado: 0.14, sombraInferior: 'rgba(30,24,14,0.5)' },
    marco: 'filmstrip', cinta: null, colorAcento: '#FFFFFF',
    colorTitulo: '#5A4632', colorSubtitulo: '#8C7B65', colorMarca: '#8C7B65',
    fuenteTitulo: FUENTE(62), fuenteSubtitulo: FUENTE_SUB(30), firma: null
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
    id: 'cuadrado-cielo', nombre: 'Bold cielo', tema: 'claro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#4E7291', lavado: 0.16, sombraInferior: 'rgba(8,20,32,0.55)' },
    marco: 'cuadrado', cinta: null, colorAcento: '#FFFFFF',
    colorTitulo: '#1F4E73', colorSubtitulo: '#4E7291', colorMarca: '#4E7291',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: null
  },
  {
    id: 'polaroid-terracota', nombre: 'Terracota', tema: 'claro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#9C4A2E', lavado: 0.16, sombraInferior: 'rgba(40,14,4,0.55)' },
    marco: 'polaroid', cinta: null, colorAcento: '#E8C4AE',
    colorTitulo: '#9C4A2E', colorSubtitulo: '#8C6250', colorMarca: '#8C6250',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: '♡'
  },
  {
    id: 'cinta-menta', nombre: 'Cinta menta', tema: 'claro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#1F6B4A', lavado: 0.14, sombraInferior: 'rgba(10,30,20,0.5)' },
    marco: 'polaroid', cinta: '#B8E8D4', colorAcento: '#B8E8D4',
    colorTitulo: '#1F6B4A', colorSubtitulo: '#4E8067', colorMarca: '#4E8067',
    fuenteTitulo: FUENTE(62), fuenteSubtitulo: FUENTE_SUB(32), firma: null
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
    id: 'carrete-oscuro', nombre: 'Carrete', tema: 'oscuro', premium: true,
    fondo: { tipo: 'gradiente-v', paradas: [[0, '#26221F'], [1, '#141210']] },
    marco: 'filmstrip', cinta: null, colorAcento: '#FFFFFF',
    colorTitulo: '#F5EDE3', colorSubtitulo: '#C9BFB3', colorMarca: '#C9BFB3',
    fuenteTitulo: FUENTE(72), fuenteSubtitulo: FUENTE_SUB(32), firma: null,
    tituloY: 150
  },
  {
    id: 'circulo-esmeralda', nombre: 'Círculos esmeralda', tema: 'oscuro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#0D211A', lavado: 0.32, sombraInferior: 'rgba(3,10,7,0.7)' },
    marco: 'circulo', cinta: null, colorAcento: '#E3B65E',
    colorTitulo: '#F0E4C8', colorSubtitulo: '#B9CFC2', colorMarca: '#B9CFC2',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: null
  },
  {
    id: 'cuadrado-carbon', nombre: 'Bold carbón', tema: 'oscuro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#0A0A0A', lavado: 0.34, sombraInferior: 'rgba(0,0,0,0.7)' },
    marco: 'cuadrado', cinta: null, colorAcento: '#FFFFFF',
    colorTitulo: '#F5F5F5', colorSubtitulo: '#A3A3A3', colorMarca: '#A3A3A3',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: null
  },
  {
    id: 'cinta-vino', nombre: 'Cinta vino', tema: 'oscuro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#3A1420', lavado: 0.3, sombraInferior: 'rgba(20,4,10,0.65)' },
    marco: 'polaroid', cinta: '#D9A0B0', colorAcento: '#D9A0B0',
    colorTitulo: '#F0C9D6', colorSubtitulo: '#D9AFBC', colorMarca: '#D9AFBC',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: '♡'
  },
  {
    id: 'polaroid-medianoche', nombre: 'Medianoche', tema: 'oscuro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#0A101F', lavado: 0.32, sombraInferior: 'rgba(4,6,14,0.7)' },
    marco: 'polaroid', cinta: null, colorAcento: '#DCE6FF',
    colorTitulo: '#DCE6FF', colorSubtitulo: '#9FB0D6', colorMarca: '#9FB0D6',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: '✨'
  },
  {
    id: 'circulo-ciruela', nombre: 'Círculos ciruela', tema: 'oscuro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#2A2035', lavado: 0.3, sombraInferior: 'rgba(12,8,16,0.65)' },
    marco: 'circulo', cinta: null, colorAcento: '#F5A9D0',
    colorTitulo: '#F5E9F0', colorSubtitulo: '#C7B3C9', colorMarca: '#9B87A3',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: null
  },
  {
    id: 'cuadrado-bosque', nombre: 'Bold bosque', tema: 'oscuro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#132018', lavado: 0.3, sombraInferior: 'rgba(4,10,7,0.65)' },
    marco: 'cuadrado', cinta: null, colorAcento: '#7ED9C3',
    colorTitulo: '#DFF5EC', colorSubtitulo: '#8FBBA9', colorMarca: '#8FBBA9',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: null
  },
  {
    id: 'filmstrip-negro', nombre: 'Carrete negro', tema: 'oscuro', premium: true,
    fondo: { tipo: 'foto-usuario', tinte: '#0A0A0A', lavado: 0.32, sombraInferior: 'rgba(0,0,0,0.7)' },
    marco: 'filmstrip', cinta: null, colorAcento: '#FFFFFF',
    colorTitulo: '#FFFFFF', colorSubtitulo: '#9AA5A0', colorMarca: '#7ED9C3',
    fuenteTitulo: FUENTE(70), fuenteSubtitulo: FUENTE_SUB(32), firma: null,
    tituloY: 140
  },
  {
    id: 'cinta-cobre', nombre: 'Cinta cobre', tema: 'oscuro', premium: false,
    fondo: { tipo: 'foto-usuario', tinte: '#241A14', lavado: 0.3, sombraInferior: 'rgba(14,8,4,0.65)' },
    marco: 'polaroid', cinta: '#C98554', colorAcento: '#C98554',
    colorTitulo: '#E8B98C', colorSubtitulo: '#C9A88F', colorMarca: '#C9A88F',
    fuenteTitulo: FUENTE(64), fuenteSubtitulo: FUENTE_SUB(32), firma: null
  }
].map((cfg) => ({ ...cfg, dibujar: (ctx, content, fuenteId) => dibujarGenerica(ctx, content, cfg, fuenteId) }));

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
