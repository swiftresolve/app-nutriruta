// Franjas de comida del día -- metadata fija y no sensible (a diferencia
// del catálogo de recetas, que ahora vive solo en Postgres, ver menu.js).
export const MEALS = [
  { id: 'desayuno', nombre: 'Desayuno', emoji: '☀️', hora: '7:00 – 8:00 am' },
  { id: 'media_manana', nombre: 'Media mañana', emoji: '🍎', hora: '10:00 am' },
  { id: 'almuerzo', nombre: 'Almuerzo', emoji: '🍽️', hora: '12:00 – 1:00 pm' },
  { id: 'media_tarde', nombre: 'Media tarde', emoji: '☕', hora: '4:00 pm' },
  { id: 'cena', nombre: 'Cena', emoji: '🌙', hora: '7:00 – 8:00 pm' }
];
