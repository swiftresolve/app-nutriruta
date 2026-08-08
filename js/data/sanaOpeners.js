// Aperturas proactivas de Sana: líneas curadas (sin llamar a la IA, sin
// costo) que hacen que Sana parezca iniciar la conversación en vez de
// solo responder. Se eligen según datos reales de la usuaria (último
// ánimo registrado, patrón de antojos, racha), nunca genéricas al azar
// cuando hay contexto disponible.

export const SANA_OPENERS = {
  animo_dificil: [
    'Vi que tu último check-in fue de un día difícil. ¿Quieres contarme qué pasó?',
    'Noté que no la pasaste muy bien hace poco. Aquí estoy si quieres hablarlo, sin apuro.'
  ],
  patron_antojo: [
    'He notado que tus antojos suelen aparecer en la {franja}. ¿Armamos juntas un plan para ese momento?',
    'Tu franja más difícil parece ser la {franja}. ¿Quieres que preparemos algo concreto para esos momentos?'
  ],
  ruta_pausada: [
    'Tu Ruta sigue disponible. Retomar también es avanzar — ¿empezamos hoy con algo pequeño?',
    'No necesitas hacerlo perfecto. ¿Qué necesitas hoy para volver a tu Ruta?'
  ],
  general: [
    '¿Cómo vas hoy con tu alimentación?',
    '¿Hay algo puntual que quieras resolver hoy?',
    'Cuéntame, ¿cómo se ha sentido tu cuerpo esta semana?',
    '¿Qué comida te está costando más sostener últimamente?'
  ]
};
