// Ruti: la nutria exploradora de NutriRuta — compañera del usuario, distinta
// del Brote de Ruta (ver ruti.js, la planta que crece con la constancia).
// Usa las ilustraciones oficiales de la usuaria (ver img/ruti/, recortadas
// de su "Biblia de expresiones") en vez de un SVG dibujado a mano. Fondo
// crema/blanco fijo en el origen -- .ruti-mascot en styles.css le pone su
// propio fondo blanco para que se lea como insignia circular a propósito,
// no como un recorte desalineado sobre tarjetas oscuras.
// Sin dependencias propias, para poder importarse desde header, quiz y
// celebraciones sin crear ciclos con app.js/store.js.

const IMG_POR_MOOD = {
  saludo: 'saludo',
  feliz: 'feliz',
  curiosa: 'curiosa',
  tranquila: 'tranquila',
  celebracion: 'celebracion'
};

// mood: 'curiosa' | 'feliz' | 'tranquila' | 'saludo' | 'celebracion'
// animated: balanceo sutil por CSS -- se apaga en modales que ya tienen su
// propia animación (ej. confeti de racha) para no competir con ella.
export function rutiMascot(mood = 'curiosa', { size = 64, animated = true } = {}) {
  const img = IMG_POR_MOOD[mood] || IMG_POR_MOOD.curiosa;
  const cls = `ruti-mascot${animated ? ' animated' : ''}`;
  return `<div class="${cls}" style="width:${size}px;height:${size}px" role="img" aria-label="Ruti, tu nutria exploradora">
    <img src="./img/ruti/${img}.png" alt="">
  </div>`;
}
