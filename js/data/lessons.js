// Micro-lecciones de 3–5 minutos y glosario.
export const LESSONS = [
  {
    id: 'azucar_oculta', emoji: '🍬', titulo: 'El azúcar oculto',
    resumen: 'Dónde se esconde el azúcar que no ves.',
    contenido: [
      'Gran parte del azúcar que consumimos no viene del azucarero: viene de jugos "naturales" industriales, salsas, panes, cereales de caja, yogures saborizados y snacks.',
      'Un vaso de jugo industrial puede tener tanta azúcar como una gaseosa. La fruta entera, en cambio, trae fibra que frena la absorción de glucosa.',
      'Truco práctico: en la etiqueta, busca ingredientes terminados en "-osa" (sacarosa, fructosa, dextrosa), jarabes y concentrados de fruta. Si aparecen en los primeros 3 ingredientes, ese producto es básicamente un postre.',
      'Primer paso realista: elimina el azúcar líquido (gaseosas, jugos, té embotellado). Es el cambio con mayor impacto en glucosa, hígado y triglicéridos.'
    ]
  },
  {
    id: 'grasas_buenas', emoji: '🥑', titulo: 'Grasas buenas vs. grasas malas',
    resumen: 'La grasa no es el enemigo; el tipo de grasa sí importa.',
    contenido: [
      'Grasas que ayudan: aceite de oliva, aguacate, frutos secos, semillas y pescado azul. Mejoran el colesterol y dan saciedad.',
      'Grasas a limitar: fritos, margarinas, productos de paquete y carnes muy grasas. Las grasas trans industriales son las más dañinas para el corazón.',
      'Sustituciones simples: cocinar con aceite de oliva en vez de manteca, cambiar el queso curado de todos los días por aguacate o nueces, y preferir horno o plancha en vez de fritura.',
      'Comer grasa buena junto a los carbohidratos reduce el pico de glucosa de la comida.'
    ]
  },
  {
    id: 'microbiota', emoji: '🦠', titulo: 'Tu microbiota, tu aliada',
    resumen: 'Los billones de bacterias que deciden mucho más de lo que crees.',
    contenido: [
      'La microbiota intestinal influye en tu digestión, tu sistema inmune, tu ánimo e incluso tus antojos.',
      'La alimenta la variedad vegetal: intenta sumar muchos tipos distintos de verduras, frutas, legumbres y granos a la semana.',
      'Los fermentados sin azúcar (yogur natural, kéfir, chucrut) aportan bacterias beneficiosas.',
      'Lo que la daña: ultraprocesados, exceso de azúcar, alcohol y dietas monótonas.'
    ]
  },
  {
    id: 'plato_modelo', emoji: '🍽️', titulo: 'El plato modelo NutriRuta',
    resumen: 'La regla de oro para armar cualquier comida.',
    contenido: [
      '½ plato de verduras (crudas o cocidas, cuanta más variedad y color, mejor).',
      '¼ de plato de carbohidrato integral: arroz integral, quinoa, batata, avena o legumbres.',
      '¼ de plato de proteína magra: huevo, pollo, pescado, tofu o legumbres.',
      'Más 1 porción de grasa saludable: aceite de oliva, aguacate o un puñado de frutos secos.',
      'Este esquema estabiliza la glucosa, protege el corazón y da saciedad real sin contar calorías.'
    ]
  },
  {
    id: 'sueno_estres', emoji: '😴', titulo: 'Sueño, estrés y glucosa',
    resumen: 'Por qué dormir mal engorda y descontrola el azúcar.',
    contenido: [
      'Dormir poco aumenta la grelina (hambre) y baja la leptina (saciedad): al día siguiente tu cuerpo pide más azúcar y más harinas.',
      'El estrés crónico eleva el cortisol, que sube la glucosa aunque no comas nada dulce.',
      'Mejorar el sueño y el estrés es parte del tratamiento de la prediabetes, no un extra opcional.',
      'Mini-hábitos: horario fijo para acostarte, nada de pantallas 30 minutos antes, y 5 respiraciones profundas antes de cada comida.'
    ]
  },
  {
    id: 'hambre_emocional', emoji: '💚', titulo: 'Hambre física vs. hambre emocional',
    resumen: 'Aprende a distinguirlas en 30 segundos.',
    contenido: [
      'Hambre física: aparece gradualmente, acepta cualquier comida, se siente en el estómago y desaparece al comer.',
      'Hambre emocional: aparece de golpe, pide algo específico (dulce, paquete), se siente "en la cabeza" y deja culpa después.',
      'Ante un antojo repentino, prueba la pausa de 10 minutos: toma un vaso de agua, respira profundo 5 veces y pregúntate qué estás sintiendo.',
      'No es falta de fuerza de voluntad: es un hábito emocional que se reentrena con un sistema. El botón SOS de esta app es tu sistema.'
    ]
  }
];

export const GLOSSARY = [
  { t: 'Resistencia a la insulina', d: 'Las células responden menos a la insulina, así que el páncreas produce más y la glucosa tiende a subir. Es reversible con alimentación, ejercicio y sueño.' },
  { t: 'Prediabetes', d: 'Glucosa más alta de lo normal sin llegar a diabetes. Es la etapa donde todavía se puede revertir el proceso.' },
  { t: 'Hígado graso', d: 'Acumulación de grasa en el hígado, muy ligada al exceso de azúcar y harinas. Mejora con dieta, ejercicio y cero alcohol.' },
  { t: 'Índice glucémico (IG)', d: 'Qué tan rápido un alimento sube la glucosa. Integrales, legumbres y fruta entera = IG bajo. Harinas blancas y azúcar = IG alto.' },
  { t: 'Fibra soluble', d: 'Tipo de fibra (avena, legumbres, manzana, linaza) que forma un gel en el intestino: baja el colesterol LDL y suaviza los picos de glucosa.' },
  { t: 'Microbiota', d: 'Comunidad de bacterias del intestino. Se alimenta de fibra variada y fermentados; se daña con ultraprocesados y azúcar.' },
  { t: 'FODMAP', d: 'Carbohidratos fermentables (en cebolla, ajo, algunas legumbres y endulzantes) que pueden causar gases y dolor en colon irritable.' },
  { t: 'Colesterol LDL', d: 'El colesterol "malo": en exceso se deposita en las arterias. Baja con fibra soluble, grasas buenas y ejercicio.' },
  { t: 'Ultraprocesado', d: 'Producto industrial con muchos ingredientes que no usarías en tu cocina. Cuanto menos aparezcan en tu semana, mejor.' }
];
