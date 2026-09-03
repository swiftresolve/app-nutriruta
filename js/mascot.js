// Ruti: la nutria exploradora de NutriRuta — compañera del usuario, distinta
// del Brote de Ruta (ver ruti.js, la planta que crece con la constancia).
// Usa las ilustraciones oficiales de la usuaria (ver img/ruti/): recortes
// de UNA sola nutria por expresión, tomados de su "Biblia de expresiones"
// (nunca la imagen/videos de la carpeta que ella marcó como no-oficial).
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
  return `<div class="${cls}" style="height:${size}px" role="img" aria-label="Ruti, tu nutria exploradora">
    <img src="./img/ruti/${img}.png" alt="">
  </div>`;
}
