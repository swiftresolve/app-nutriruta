// "Tu paso de hoy": obstáculo + micro-acción "si...entonces" + el porqué
// fisiológico. Contenido curado con respaldo en nutrición clínica y
// psicología conductual (intenciones de implementación), nunca inventado —
// ver memoria "solo info comprobada". `contexto` coincide con las franjas
// horarias que ya calcula cravingPattern() en store.js ('mañana', 'mediodía',
// 'tarde', 'noche'); 'general' es el respaldo cuando aún no hay patrón claro.

export const DAILY_STEPS = [
  // --- mañana ---
  {
    id: 'manana_desayuno_proteina',
    contexto: 'mañana',
    obstaculo: 'Sales de casa sin desayunar y a media mañana el hambre te gana.',
    accion: 'Si hoy no alcanzas a desayunar completo, entonces lleva un puñado de frutos secos o un huevo cocido — algo con proteína que sostenga tu energía hasta el almuerzo.',
    porque: 'La proteína y la grasa se digieren más lento que el azúcar, así que mantienen tu glucosa estable y evitan el bajón de las 10am.'
  },
  {
    id: 'manana_cafe_ayunas',
    contexto: 'mañana',
    obstaculo: 'El café con el estómago vacío te deja con más ansiedad, no menos.',
    accion: 'Si vas a tomar café en ayunas, entonces acompáñalo con algo pequeño de comida, aunque sea poco.',
    porque: 'La cafeína sin nada en el estómago puede elevar el cortisol y la sensación de ansiedad en algunas personas.'
  },
  {
    id: 'manana_movimiento',
    contexto: 'mañana',
    obstaculo: 'Te cuesta empezar el día con movimiento.',
    accion: 'Si no tienes tiempo para ejercicio, entonces camina 5 minutos apenas te levantes, aunque sea dentro de casa.',
    porque: 'Un poco de movimiento en la mañana ayuda a regular el apetito y el ánimo durante el resto del día.'
  },
  {
    id: 'manana_saltar_desayuno',
    contexto: 'mañana',
    obstaculo: "Te saltas el desayuno pensando que 'ahorras' calorías.",
    accion: 'Si llevas horas sin comer al despertar, entonces desayuna algo, aunque sea pequeño, antes de tu primera hora de trabajo.',
    porque: 'Saltarse comidas suele generar más hambre y peores decisiones en la comida siguiente, no menos calorías en el día.'
  },

  // --- mediodía ---
  {
    id: 'mediodia_comer_sin_pantalla',
    contexto: 'mediodía',
    obstaculo: 'El almuerzo de oficina o afán te deja comiendo rápido y sin registrar cuánto comiste.',
    accion: 'Si vas a almorzar con poco tiempo, entonces aparta al menos los primeros minutos sin pantalla.',
    porque: 'Comer sin distracción ayuda a que tu cuerpo registre la señal de saciedad a tiempo, en vez de notarla 20 minutos después.'
  },
  {
    id: 'mediodia_bajon_post_almuerzo',
    contexto: 'mediodía',
    obstaculo: 'A media tarde te da sueño justo después de almorzar.',
    accion: 'Si el bajón de después de almorzar te pega fuerte, entonces procura que tu plato tenga fibra y proteína, no solo carbohidratos simples.',
    porque: 'Un almuerzo muy alto en azúcares o harinas refinadas genera un pico de glucosa seguido de una caída — ese es el sueño post-almuerzo.'
  },
  {
    id: 'mediodia_agua_visible',
    contexto: 'mediodía',
    obstaculo: 'Se te olvida tomar agua durante la jornada.',
    accion: 'Si sueles olvidar el agua a mediodía, entonces deja la botella donde la veas, no en la mochila.',
    porque: 'La sed leve a veces se confunde con hambre; tener el agua a la vista reduce ese error.'
  },

  // --- tarde ---
  {
    id: 'tarde_antojo_dulce_agua',
    contexto: 'tarde',
    obstaculo: 'El antojo de dulce a media tarde aparece casi todos los días.',
    accion: 'Si te da antojo de dulce a esta hora, entonces toma un vaso de agua primero y espera 10 minutos antes de decidir.',
    porque: 'La sed leve se siente parecida al antojo de azúcar; muchas veces el cuerpo solo necesitaba agua.'
  },
  {
    id: 'tarde_cafe_acompanante',
    contexto: 'tarde',
    obstaculo: 'El café de la tarde te sabe a excusa para comer algo dulce con él.',
    accion: 'Si vas a tomarte un café en la tarde, entonces ten lista una fruta o un yogur natural cerca, no galletas a la vista.',
    porque: 'Lo que tienes más accesible es lo que más probablemente comes — cambiar qué está a la mano cambia la decisión sin necesitar fuerza de voluntad.'
  },
  {
    id: 'tarde_hambre_emocional',
    contexto: 'tarde',
    obstaculo: "El cansancio del día te hace buscar comida como 'premio'.",
    accion: 'Si notas que buscas comida por cansancio y no por hambre real, entonces pregúntate: ¿tengo hambre de estómago o solo quiero un descanso?',
    porque: 'Distinguir hambre física de hambre emocional es el primer paso para responder distinto, sin culpa.'
  },

  // --- noche ---
  {
    id: 'noche_cepillar_dientes',
    contexto: 'noche',
    obstaculo: 'El antojo nocturno aparece justo después de cenar o antes de dormir.',
    accion: "Si el antojo llega en la noche, entonces cepíllate los dientes apenas termines de cenar — una señal clara de 'cocina cerrada'.",
    porque: 'Es una técnica simple de cambio de contexto: reduce la probabilidad de picar algo más sin necesitar fuerza de voluntad.'
  },
  {
    id: 'noche_cenar_mas_temprano',
    contexto: 'noche',
    obstaculo: 'Cenas tarde y sin mucha hambre real, más por costumbre.',
    accion: 'Si cenas muy tarde por costumbre, entonces prueba adelantar la cena unos 30 a 60 minutos esta semana.',
    porque: 'Dejar más tiempo entre la cena y la hora de dormir suele mejorar la digestión y la calidad del sueño.'
  },
  {
    id: 'noche_sueno_antojo',
    contexto: 'noche',
    obstaculo: 'Duermes poco y al día siguiente los antojos son peores.',
    accion: 'Si sabes que dormiste mal, entonces ese día prepara con anticipación una alternativa saludable para el antojo — vendrá más fuerte.',
    porque: 'La falta de sueño altera las hormonas del hambre (grelina y leptina), aumentando el antojo por azúcar y harinas al día siguiente.'
  },
  {
    id: 'noche_pantallas',
    contexto: 'noche',
    obstaculo: 'Ver pantallas antes de dormir te deja con ganas de picar algo.',
    accion: 'Si sueles picar algo viendo el celular o la tele en la noche, entonces cambia el snack por una infusión o agua con limón mientras ves la pantalla.',
    porque: 'El picoteo nocturno frente a pantallas suele ser por hábito o aburrimiento, no por hambre real.'
  },

  // --- general (sin patrón claro todavía) ---
  {
    id: 'general_registrar_patron',
    contexto: 'general',
    obstaculo: 'Aún no sabes bien en qué momento del día te cuesta más sostener tus hábitos.',
    accion: 'Si hoy no identificas tu momento difícil, entonces usa el botón SOS la próxima vez que sientas un antojo fuerte, para ir armando tu patrón.',
    porque: 'Con unos días de registro, la app puede identificar tu franja horaria más difícil y darte pasos más precisos.'
  },
  {
    id: 'general_constancia_no_resultado',
    contexto: 'general',
    obstaculo: "Cuesta mantener la constancia cuando no ves resultados rápido.",
    accion: "Si sientes que 'no está pasando nada', entonces hoy revisa tu racha de días, no tu peso.",
    porque: 'Los cambios metabólicos reales toman semanas; los hábitos sostenidos son el mejor predictor de resultados a largo plazo.'
  },
  {
    id: 'general_mal_dia',
    contexto: 'general',
    obstaculo: "Un mal día te hace sentir que 'ya perdiste' toda la semana.",
    accion: 'Si hoy no cumpliste como querías, entonces vuelve mañana sin necesidad de compensar de más — un día no define tu proceso.',
    porque: 'La restricción compensatoria después de un desliz suele generar más ciclos de atracón, no menos.'
  },
  {
    id: 'general_respirar_antes_comer',
    contexto: 'general',
    obstaculo: 'El estrés del día te hace comer más rápido y sin pensar.',
    accion: 'Si el día viene pesado, entonces antes de tu próxima comida respira profundo 3 veces.',
    porque: 'El sistema nervioso en estado de estrés desvía energía de la digestión; una pausa corta ayuda a tu cuerpo a procesar mejor la comida.'
  }
];
