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
  celebracion: 'celebracion',
  hambre: 'hambre' // Ruti Tamagotchi (ver estadoRutiHoy en store.js) -- recorte nuevo de la Biblia de expresiones (ORGULLO), pendiente reemplazar por una pose de "Preocupación" dedicada cuando la usuaria la exporte
};

// mood: 'curiosa' | 'feliz' | 'tranquila' | 'saludo' | 'celebracion' | 'hambre'
// animated: balanceo sutil por CSS -- se apaga en modales que ya tienen su
// propia animación (ej. confeti de racha) para no competir con ella.
export function rutiMascot(mood = 'curiosa', { size = 64, animated = true } = {}) {
  const img = IMG_POR_MOOD[mood] || IMG_POR_MOOD.curiosa;
  const cls = `ruti-mascot${animated ? ' animated' : ''}`;
  return `<div class="${cls}" style="height:${size}px" role="img" aria-label="Ruti, tu nutria exploradora">
    <img src="./img/ruti/${img}.png" alt="">
  </div>`;
}

// Banco de frases de Ruti, por estado emocional del día (ver estadoRutiHoy
// en store.js) -- varias por estado para que no se sienta repetitivo, se
// elige una al azar en cada render. "{comida}" se reemplaza por el nombre
// de la comida en juego cuando aplica. Tono cálido, nunca de culpa (ver
// [[proyecto-nutriruta-ruti-biblia]]).
const FRASES_RUTI = {
  despertando: ['Buenos días, hoy vamos paso a paso 🌱', '¡Ya llegó otro día para cuidarte! ¿Empezamos?'],
  hambre_leve: ['Se acerca la hora de tu {comida}… ¿ya tienes plan?', 'En un rato es momento de {comida}. Te ayudo si quieres 🌿'],
  hambre_activa: ['Tengo hambre de {comida} 🌱 ¿vemos algo rápido juntas?', '¿Se te pasó la hora de {comida}? No pasa nada, elige algo ahora mismo'],
  bajo_energia: ['Ando bajito de energía hoy, pero mañana seguimos sin culpa', 'Un día tranquilo también cuenta. Aquí estaré mañana 🌱'],
  sediento: ['Creo que necesito agua… ¿tú también vas baja hoy?', 'Un vaso de agua nos vendría bien a las dos 💧'],
  dormido: ['Hoy hiciste bien tu ruta. Buenas noches 🌙', 'Gracias por cuidarme hoy. Descansa 🌿'],
  feliz: ['¡Qué rico, gracias! Me siento con energía 💪🌿', 'Vamos muy bien hoy 🌿']
};

export function fraseRuti(estado) {
  const opciones = FRASES_RUTI[estado.key] || FRASES_RUTI.feliz;
  const frase = opciones[Math.floor(Math.random() * opciones.length)];
  return estado.comida ? frase.replace('{comida}', estado.comida.nombre.toLowerCase()) : frase;
}
