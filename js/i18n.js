// Traducción de la interfaz (ES/EN). El texto en español ES la llave del
// diccionario -- así envolver un string existente en t('...') no obliga a
// inventar claves nuevas por separado, y si falta una traducción el texto
// en español se sigue mostrando tal cual (nunca una pantalla rota o vacía
// por una traducción faltante).
//
// Alcance: por ahora solo la interfaz (botones, títulos, mensajes). Las
// recetas (nombres, descripciones, pasos) siguen solo en español -- son
// contenido nutricional, un proyecto de traducción aparte (ver memoria
// proyecto-nutriruta-fitia). idiomaInterfaz vive en user.idiomaInterfaz
// (ver store.js), separado de "unidades" (métrico/imperial).
import { getState } from './store.js';

export function getIdioma() {
  return getState().user?.idiomaInterfaz === 'en' ? 'en' : 'es';
}

// t(texto, vars?): vars permite interpolar sin tener que armar la llave
// completa por cada valor dinámico, ej. t('Hola, {nombre}', {nombre: 'Ana'}).
export function t(texto, vars) {
  const idioma = getIdioma();
  let salida = idioma === 'en' ? (EN[texto] ?? texto) : texto;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) salida = salida.replaceAll(`{${k}}`, v);
  }
  return salida;
}

const EN = {
  // --- Navegación inferior (index.html) ---
  'Hoy': 'Today',
  'Recetas': 'Recipes',
  'SOS': 'SOS',
  'Progreso': 'Progress',
  'Aprende': 'Learn',

  // --- Header / ajustes ---
  'Ajustes': 'Settings',
  'Tus Días en Ruta': 'Your Days on Track',
  'Tus gemas': 'Your gems',
  'Tus Pausas de Ruta': 'Your Track Pauses',

  // --- Dashboard: saludo y tarjetas ---
  'Buenos días': 'Good morning',
  'Buenas tardes': 'Good afternoon',
  'Buenas noches': 'Good evening',
  'Hoy es un buen día para cuidarte. Progreso, no perfección.': 'Today is a good day to take care of yourself. Progress, not perfection.',
  'Tu paso de hoy': 'Your step today',
  'Hecho ✓': 'Done ✓',
  '{n} Días en Ruta dando tu paso': '{n} Days on Track taking your step',
  'Completado por hoy 🌿': 'Completed for today 🌿',
  'Ya lo hice ✓': 'I did it ✓',
  '¡Bien hecho! 🌿': 'Well done! 🌿',
  'Hábitos de hoy': 'Today\'s habits',
  'Marca al menos 3 para sumar a tu Ruta. Agua y menú se marcan solos.': 'Check at least 3 to count toward your Track. Water and menu check themselves.',
  'automático': 'automatic',
  '💧 Agua': '💧 Water',
  'vasos': 'glasses',
  'Vaso {n}': 'Glass {n}',
  '¡Meta de agua cumplida! 💧🎉': 'Water goal reached! 💧🎉',
  'Hemos notado': 'We\'ve noticed',
  'que tus antojos suelen aparecer en la': 'that your cravings tend to show up in the',
  'Prepara con anticipación un snack saludable para ese momento.': 'Prepare a healthy snack ahead of time for that moment.',
  'Vas con poca agua hoy y en migrañas los horarios y la hidratación importan tanto como la comida. Toma un vaso y no dejes pasar mucho tiempo sin comer.': 'You\'re low on water today, and with migraines, timing and hydration matter as much as food. Have a glass and don\'t go too long without eating.',
  '🍽️ Tu ruta de hoy': '🍽️ Your route today',
  'Sin opciones con tus exclusiones actuales': 'No options with your current exclusions',
  'Ahora': 'Now',
  // Nombres de las comidas (data/recipes.js MEALS) — se usan en todo lado, no solo el dashboard.
  'Desayuno': 'Breakfast',
  'Media mañana': 'Mid-morning',
  'Almuerzo': 'Lunch',
  'Media tarde': 'Afternoon snack',
  'Cena': 'Dinner',
  '🛒 Ver lista de compras': '🛒 View shopping list',
  '🔍 ¿Qué tienes en casa?': '🔍 What do you have at home?',
  '📅 Ver la semana': '📅 View the week',
  '📔 Mi Diario': '📔 My Diary',
  '💚 Tengo ansiedad / antojo': '💚 I\'m anxious / craving',
  '🏁 Plan de 7 días': '🏁 7-day plan',
  'Completado': 'Completed',
  'Diste el primer paso — revisa tu semana cuando quieras.': 'You took the first step — check your week whenever you like.',
  'Ver mi plan →': 'View my plan →',
  'Continuar mi plan →': 'Continue my plan →',
  'Gratis': 'Free',
  'Empezar hoy mismo →': 'Start today →',
  ', tu guía': ', your guide',
  'Una duda puntual, ahora mismo, con el contexto de tu perfil.': 'A quick question, right now, with your profile\'s context.',
  'Premium': 'Premium',
  'Abrir chat →': 'Open chat →',
  'Conocer más →': 'Learn more →',
  '🎯 Misión 12 semanas': '🎯 12-week Mission',
  'Pausada': 'Paused',
  'Continuar mi misión →': 'Continue my mission →',
  'Renovar Premium para continuar →': 'Renew Premium to continue →',
  'Empezar mi misión →': 'Start my mission →',
  'Conocer la misión →': 'Learn about the mission →',

  // --- Modal de "¿Qué comiste?" y registro de comida ---
  'Cambiar receta': 'Change recipe',
  'Editar lo que comiste': 'Edit what you ate',
  '¿Qué comiste realmente?': 'What did you really eat?',
  'Registrar lo que comiste': 'Log what you ate',

  // --- Reflexión de hábitos ---
  'Antes de sumar hoy…': 'Before counting today…',
  'En una frase, ¿qué hiciste hoy para esto? Nos ayuda a que tu Ruta refleje algo real, no solo un toque.': 'In one sentence, what did you do today for this? It helps your Track reflect something real, not just a tap.',
  'Sumar a mi Ruta ✓': 'Add to my Track ✓',

  // --- Detalle de receta ---
  'Ingredientes': 'Ingredients',
  'Preparación': 'Preparation',
  'Semáforo': 'Traffic light',
  'sustituto de': 'substitute for'
};
