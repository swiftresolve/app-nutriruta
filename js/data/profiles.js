// Perfiles de salud que gestiona NutriRuta.
export const PROFILES = {
  higado_graso: {
    id: 'higado_graso',
    nombre: 'Hígado graso',
    emoji: '🫀',
    objetivo: 'Reducir grasa hepática y mejorar la sensibilidad a la insulina.',
    claves: [
      'Más verduras de hoja verde y crucíferas.',
      'Pescado al horno o a la plancha, legumbres y cereales integrales.',
      'Evitar fritos, azúcares, harinas refinadas y alcohol.'
    ],
    habitos: ['Ejercicio moderado 150 min/semana', 'Cero alcohol', 'Fruta entera en vez de jugos']
  },
  resistencia_insulina: {
    id: 'resistencia_insulina',
    nombre: 'Resistencia a la insulina',
    emoji: '🩸',
    objetivo: 'Evitar picos de glucosa y mejorar la sensibilidad a la insulina.',
    claves: [
      'Desayunos con proteína y grasa saludable, poca harina refinada.',
      'Carbohidratos siempre combinados con proteína y grasa.',
      'Agua, infusiones y café sin azúcar en vez de bebidas azucaradas.'
    ],
    habitos: ['Comer cada 4–5 horas', 'Ejercicio 150 min/semana', 'Fibra y fermentados a diario']
  },
  prediabetes: {
    id: 'prediabetes',
    nombre: 'Prediabetes / riesgo de diabetes',
    emoji: '🛡️',
    objetivo: 'Frenar o revertir la progresión hacia diabetes tipo 2.',
    claves: [
      'Menos azúcares refinados y grasas saturadas.',
      'Fibra diaria de 25–35 g y proteína en cada comida.',
      'Más frutas enteras, verduras, granos integrales y aceite de oliva.'
    ],
    habitos: ['Ejercicio aeróbico 30 min × 5 días', 'Dormir bien', 'Manejo de estrés', 'Controles médicos regulares']
  },
  colon_irritable: {
    id: 'colon_irritable',
    nombre: 'Colon irritable (SII)',
    emoji: '🌱',
    objetivo: 'Reducir gases, dolor e irregularidad, cuidando la microbiota.',
    claves: [
      'Preferir arroz, avena y frutas suaves según tolerancia.',
      'Reducir cebolla, ajo, algunas legumbres y endulzantes.',
      'Registrar qué alimentos sientan mal y regenerar alternativas.'
    ],
    habitos: ['Comer despacio', 'Hidratación constante', 'Identificar gatillos personales']
  },
  migranas: {
    id: 'migranas',
    nombre: 'Migrañas',
    emoji: '🧠',
    objetivo: 'Reducir frecuencia e intensidad con estabilidad energética e hidratación.',
    claves: [
      'Horarios regulares de comida, sin ayunos prolongados.',
      'Meta de agua diaria (1.5–2 litros).',
      'Moderar cafeína, alcohol, glutamato y quesos curados si son gatillo.'
    ],
    habitos: ['Comidas a horario fijo', 'Agua suficiente cada día', 'Registrar gatillos']
  },
  candidiasis: {
    id: 'candidiasis',
    nombre: 'Candidiasis',
    emoji: '🌸',
    objetivo: 'Limitar el alimento de Candida y apoyar la flora intestinal.',
    claves: [
      'Verduras verdes, proteínas magras y grasas saludables.',
      'Fermentados sin azúcar: yogur natural, kéfir, chucrut.',
      'Evitar azúcar, levadura, alcohol y harinas refinadas.'
    ],
    habitos: ['Cero azúcar añadida', 'Fermentados diarios', 'Preferir integrales sin gluten si hay sensibilidad']
  },
  colesterol: {
    id: 'colesterol',
    nombre: 'Colesterol alto / corazón',
    emoji: '❤️',
    objetivo: 'Reducir colesterol LDL, triglicéridos y riesgo cardiovascular.',
    claves: [
      'Medio plato de verduras sin almidón en las comidas.',
      'Fibra soluble: avena, legumbres, manzana, cítricos, linaza.',
      'Sustituir grasas saturadas por aceite de oliva, aguacate y frutos secos.'
    ],
    habitos: ['Ejercicio 150–300 min/semana', 'No fumar', 'Dormir bien y manejar estrés']
  }
};

// Grupos de exclusión disponibles (alergias / intolerancias / preferencias).
export const EXCLUSIONS = [
  { id: 'pescado', nombre: 'Pescado', emoji: '🐟' },
  { id: 'mariscos', nombre: 'Mariscos', emoji: '🦐' },
  { id: 'lacteos', nombre: 'Lácteos', emoji: '🥛' },
  { id: 'gluten', nombre: 'Gluten', emoji: '🌾' },
  { id: 'frutos_secos', nombre: 'Frutos secos', emoji: '🥜' },
  { id: 'huevo', nombre: 'Huevo', emoji: '🥚' },
  { id: 'legumbres', nombre: 'Legumbres', emoji: '🫘' },
  { id: 'soya', nombre: 'Soya', emoji: '🫛' }
];

export const GOALS = [
  { id: 'energia', nombre: 'Mejorar energía', emoji: '⚡' },
  { id: 'peso', nombre: 'Bajar de peso', emoji: '⚖️' },
  { id: 'azucar', nombre: 'Reducir azúcar', emoji: '🍬' },
  { id: 'digestion', nombre: 'Mejorar digestión', emoji: '🌿' },
  { id: 'colesterol', nombre: 'Bajar colesterol', emoji: '❤️' },
  { id: 'hormonas', nombre: 'Equilibrio hormonal', emoji: '🌸' },
  { id: 'migranas', nombre: 'Menos migrañas', emoji: '🧠' },
  { id: 'ansiedad', nombre: 'Menos ansiedad por comida', emoji: '💚' }
];

export const HARD_HABITS = [
  { id: 'hambre_emocional', nombre: 'Hambre emocional' },
  { id: 'antojo_dulce', nombre: 'Antojos de dulce' },
  { id: 'picoteo_nocturno', nombre: 'Comer tarde en la noche' },
  { id: 'comer_fuera', nombre: 'Comer fuera de casa' },
  { id: 'poca_agua', nombre: 'Tomar poca agua' },
  { id: 'constancia', nombre: 'Ser constante' },
  { id: 'estres', nombre: 'Comer rápido o por estrés' }
];
