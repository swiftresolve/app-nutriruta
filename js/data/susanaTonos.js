// Cómo le habla SuSana a cada quien -- el mismo listado que usan el quiz
// (js/views/quiz.js), Ajustes y "Personalizar a SuSana" (assistant.js), con
// una frase de ejemplo real para mostrar en vivo cómo suena cada tono
// (inspirado en el selector de tono de Fitia Coach, pero con las frases
// reales de SuSana, nunca las suyas). El backend (ai-assistant) tiene su
// propia versión de estas descripciones para el prompt del modelo -- ver
// TONOS en supabase/functions/ai-assistant/index.ts, deben decir lo mismo.
export const SUSANA_TONOS = [
  {
    id: 'calida',
    emoji: '💛',
    nombre: 'Cálida',
    desc: 'cercana y suave, el tono de siempre',
    ejemplo: '¡Qué bien que volviste hoy! No pasa nada si ayer no fue perfecto — lo que importa es que sigues aquí, cuidándote 💚'
  },
  {
    id: 'motivadora',
    emoji: '🌟',
    nombre: 'Motivadora',
    desc: 'más entusiasta, celebra cada avance',
    ejemplo: '¡Eso es! Superaste ese antojo hoy y eso también cuenta como una victoria 🙌 Vas mejor de lo que crees.'
  },
  {
    id: 'directa',
    emoji: '🎯',
    nombre: 'Directa',
    desc: 'va al punto, menos rodeos',
    ejemplo: 'Ayer comiste bien. Hoy repite lo mismo: proteína en cada comida y agua suficiente. Así de simple.'
  }
];
