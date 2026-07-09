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
  },
  gases: {
    id: 'gases',
    nombre: 'Gases e hinchazón',
    emoji: '🎈',
    objetivo: 'Reducir gases y distensión abdominal identificando tus disparadores personales.',
    claves: [
      'Aumentar la fibra poco a poco, no de golpe.',
      'Moderar legumbres, crucíferas (brócoli, coliflor, repollo), cebolla y ajo si te inflaman.',
      'Comer despacio y en porciones más pequeñas si hay distensión.'
    ],
    habitos: ['Registrar qué te hincha en el diario de síntomas', 'Comer sin afán', 'Subir la fibra de forma gradual']
  },
  estrenimiento: {
    id: 'estrenimiento',
    nombre: 'Estreñimiento',
    emoji: '🚰',
    objetivo: 'Mejorar la frecuencia y facilidad de evacuación con fibra, agua y movimiento.',
    claves: [
      'Agua suficiente durante todo el día, no solo con las comidas.',
      'Fibra de frutas (kiwi, papaya, pera, ciruela), avena, chía y linaza.',
      'Movimiento diario: hasta caminar ayuda al tránsito intestinal.'
    ],
    habitos: ['Meta diaria de agua', 'Fibra en cada comida', 'No aguantar las ganas de ir al baño']
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

// Tipos de síntoma para el diario (detector de disparadores unificado).
export const SYMPTOM_TYPES = [
  { id: 'gases', nombre: 'Gases / hinchazón', emoji: '🎈' },
  { id: 'estrenimiento', nombre: 'Estreñimiento', emoji: '🚰' },
  { id: 'diarrea', nombre: 'Diarrea', emoji: '💧' },
  { id: 'dolor_abdominal', nombre: 'Dolor abdominal', emoji: '🤕' },
  { id: 'migrana', nombre: 'Dolor de cabeza / migraña', emoji: '🧠' },
  { id: 'otro', nombre: 'Otro', emoji: '📋' }
];

// Causas reales y específicas al empezar cambios de alimentación (no "detox":
// el cuerpo no necesita ayuda para "eliminar toxinas" con la comida; estos
// síntomas tienen explicaciones fisiológicas conocidas). Incluye cuándo
// consultar a un profesional en vez de asumir que "es normal".
export const SYMPTOM_CAUSES = {
  gases: 'Un aumento de fibra (verduras, legumbres, granos) suele producir más gas mientras tu microbiota intestinal se adapta a fermentar nuevas fibras. Suele mejorar en 1–2 semanas si subes la fibra de forma gradual y tomas suficiente agua.',
  estrenimiento: 'Si subiste la fibra pero no el agua, el resultado puede ser el contrario al esperado: la fibra necesita agua para moverse bien por el intestino. Revisa tu consumo de agua estos días antes que nada.',
  diarrea: 'Cambios grandes en la alimentación (más grasas saludables, más fibra, menos ultraprocesados) pueden acelerar el tránsito intestinal los primeros días mientras tu cuerpo se ajusta.',
  dolor_abdominal: 'Una molestia leve puede aparecer cuando el intestino se adapta a nuevos alimentos. Si el dolor es intenso, no mejora en unos días o viene con otros síntomas, consulta a tu médico: no lo asumas como parte normal del proceso.',
  migrana: 'Saltarte comidas, la deshidratación y los cambios bruscos de horario son disparadores frecuentes de migraña. Revisa tu horario de comidas y agua antes de asumir que es por la alimentación nueva.',
  otro: null
};

// Retos frecuentes, en primera persona para que se lean como "me pasa esto".
export const HARD_HABITS = [
  { id: 'hambre_emocional', nombre: 'Como por emociones, no por hambre' },
  { id: 'antojo_dulce', nombre: 'Me dan antojos de dulce' },
  { id: 'picoteo_nocturno', nombre: 'Picoteo tarde en la noche' },
  { id: 'comer_fuera', nombre: 'Como fuera de casa muy seguido' },
  { id: 'poca_agua', nombre: 'Tomo poca agua' },
  { id: 'constancia', nombre: 'Me cuesta ser constante' },
  { id: 'estres', nombre: 'Como rápido o por estrés' }
];
