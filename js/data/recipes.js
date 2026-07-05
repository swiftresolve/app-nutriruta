// Recetario Savibra.
// Cada ingrediente puede tener `grupo` (clave de exclusión) y `sub` (sustituto si el grupo está excluido).
// `apto`: perfiles donde la receta es especialmente recomendada (verde).
// `moderar`: perfiles donde conviene consumo moderado (amarillo).
// `evitar`: perfiles donde se marca en rojo.

export const MEALS = [
  { id: 'desayuno', nombre: 'Desayuno', emoji: '🌅' },
  { id: 'media_manana', nombre: 'Media mañana', emoji: '🍎' },
  { id: 'almuerzo', nombre: 'Almuerzo', emoji: '🍽️' },
  { id: 'media_tarde', nombre: 'Media tarde', emoji: '☕' },
  { id: 'cena', nombre: 'Cena', emoji: '🌙' }
];

export const RECIPES = [
  // ================= DESAYUNOS =================
  {
    id: 'omelette_espinaca', comida: 'desayuno', emoji: '🍳',
    nombre: 'Omelette de espinaca y tomate',
    descripcion: 'Proteína y verduras para empezar el día con glucosa estable.',
    ingredientes: [
      { n: '2 huevos', grupo: 'huevo', sub: 'tofu firme revuelto (media taza)' },
      { n: '1 taza de espinaca fresca' },
      { n: '1 tomate pequeño en cubos' },
      { n: '1 cdta de aceite de oliva' },
      { n: '½ aguacate pequeño' },
      { n: '1 rebanada de pan integral', grupo: 'gluten', sub: '3 cdas de avena sin gluten cocida' }
    ],
    pasos: [
      'Batir los huevos y mezclarlos con la espinaca y el tomate.',
      'Cocinar en sartén con el aceite de oliva a fuego medio.',
      'Servir con el aguacate y el pan integral.'
    ],
    apto: ['higado_graso', 'resistencia_insulina', 'prediabetes', 'colesterol', 'candidiasis', 'migranas'],
    etiquetas: ['alto_proteina', 'bajo_azucar']
  },
  {
    id: 'avena_nocturna', comida: 'desayuno', emoji: '🥣',
    nombre: 'Avena nocturna con chía y fresas',
    descripcion: 'Fibra soluble y proteína: ideal para colesterol y glucosa.',
    ingredientes: [
      { n: '4 cdas de avena integral', grupo: 'gluten', sub: 'avena certificada sin gluten' },
      { n: '1 cda de semillas de chía' },
      { n: '¾ taza de yogur natural sin azúcar', grupo: 'lacteos', sub: 'bebida de almendra o soya sin azúcar' },
      { n: '5 fresas en trozos' },
      { n: 'Canela al gusto' }
    ],
    pasos: [
      'Mezclar la avena, la chía y el yogur en un frasco.',
      'Refrigerar toda la noche.',
      'Servir con las fresas y canela por encima.'
    ],
    apto: ['colesterol', 'resistencia_insulina', 'prediabetes', 'colon_irritable', 'migranas'],
    moderar: ['candidiasis'],
    etiquetas: ['alto_fibra', 'fibra_soluble']
  },
  {
    id: 'tostada_aguacate_huevo', comida: 'desayuno', emoji: '🥑',
    nombre: 'Tostada integral con aguacate y huevo',
    descripcion: 'Grasa buena + proteína: saciedad sin picos de glucosa.',
    ingredientes: [
      { n: '1 rebanada de pan 100 % integral', grupo: 'gluten', sub: 'tortilla de maíz o pan sin gluten' },
      { n: '½ aguacate' },
      { n: '1 huevo cocido o pochado', grupo: 'huevo', sub: 'hummus (2 cdas)', subGrupo: 'legumbres' },
      { n: 'Semillas de linaza y limón al gusto' }
    ],
    pasos: [
      'Tostar el pan.',
      'Untar el aguacate y colocar el huevo encima.',
      'Terminar con linaza, limón y pimienta.'
    ],
    apto: ['resistencia_insulina', 'prediabetes', 'colesterol', 'higado_graso'],
    moderar: ['candidiasis'],
    etiquetas: ['grasa_saludable']
  },
  {
    id: 'batido_verde', comida: 'desayuno', emoji: '🥬',
    nombre: 'Batido verde con proteína',
    descripcion: 'Verduras y proteína en 5 minutos, sin azúcar añadida.',
    ingredientes: [
      { n: '1 taza de espinaca' },
      { n: '½ banano maduro' },
      { n: '1 taza de bebida de almendra sin azúcar', grupo: 'frutos_secos', sub: 'bebida de avena o agua' },
      { n: '2 cdas de yogur griego natural', grupo: 'lacteos', sub: 'tofu suave (¼ taza)', subGrupo: 'soya' },
      { n: '1 cda de linaza molida' }
    ],
    pasos: [
      'Licuar todos los ingredientes hasta que quede cremoso.',
      'Tomar despacio, acompañado de un puñado pequeño de frutos secos si hay más hambre.'
    ],
    apto: ['migranas', 'colon_irritable', 'higado_graso', 'colesterol'],
    moderar: ['resistencia_insulina', 'candidiasis'],
    etiquetas: ['rapido']
  },
  {
    id: 'arepa_huevo_verduras', comida: 'desayuno', emoji: '🫓',
    nombre: 'Arepa de maíz con huevo y verduras',
    descripcion: 'Versión balanceada del clásico: maíz integral + proteína.',
    ingredientes: [
      { n: '1 arepa pequeña de maíz (sin queso)' },
      { n: '1 huevo revuelto', grupo: 'huevo', sub: 'frijoles negros (media taza)', subGrupo: 'legumbres' },
      { n: 'Tomate y cilantro picados' },
      { n: '1 cdta de aceite de oliva' }
    ],
    pasos: [
      'Asar la arepa a la plancha.',
      'Revolver el huevo con el tomate y el cilantro.',
      'Servir junto con un vaso de agua o café sin azúcar.'
    ],
    apto: ['candidiasis', 'migranas', 'higado_graso'],
    moderar: ['resistencia_insulina', 'prediabetes'],
    etiquetas: ['sin_gluten', 'local']
  },
  {
    id: 'yogur_bowl', comida: 'desayuno', emoji: '🫐',
    nombre: 'Bowl de yogur, nueces y arándanos',
    descripcion: 'Fermentados + fibra para la microbiota.',
    ingredientes: [
      { n: '1 taza de yogur natural o kéfir sin azúcar', grupo: 'lacteos', sub: 'yogur de coco sin azúcar' },
      { n: '8 nueces', grupo: 'frutos_secos', sub: '1 cda de semillas de girasol' },
      { n: '½ taza de arándanos o mora' },
      { n: '1 cda de avena', grupo: 'gluten', sub: 'quinoa inflada' }
    ],
    pasos: [
      'Servir el yogur en un bowl.',
      'Agregar la fruta, las nueces y la avena.',
      'Comer despacio, masticando bien.'
    ],
    apto: ['candidiasis', 'colesterol', 'resistencia_insulina', 'prediabetes', 'colon_irritable'],
    etiquetas: ['fermentado', 'microbiota']
  },
  {
    id: 'panqueques_avena', comida: 'desayuno', emoji: '🥞',
    nombre: 'Panqueques de avena y banano',
    descripcion: 'Dulce natural sin azúcar añadida ni harina blanca.',
    ingredientes: [
      { n: '½ taza de avena molida', grupo: 'gluten', sub: 'avena sin gluten molida' },
      { n: '1 banano maduro' },
      { n: '1 huevo', grupo: 'huevo', sub: '1 cda de linaza + 3 cdas de agua (huevo de linaza)' },
      { n: 'Canela y 1 cdta de aceite de coco' }
    ],
    pasos: [
      'Licuar avena, banano y huevo.',
      'Cocinar porciones pequeñas en sartén a fuego bajo.',
      'Servir con fruta fresca, no con miel ni sirope.'
    ],
    apto: ['migranas', 'colon_irritable'],
    moderar: ['resistencia_insulina', 'prediabetes', 'higado_graso'],
    evitar: ['candidiasis'],
    etiquetas: ['antojo_dulce_saludable']
  },

  // ================= MEDIA MAÑANA =================
  {
    id: 'manzana_almendras', comida: 'media_manana', emoji: '🍎',
    nombre: 'Manzana con almendras',
    descripcion: 'El snack anti-antojo clásico: fibra + grasa buena.',
    ingredientes: [
      { n: '1 manzana con piel' },
      { n: '12 almendras', grupo: 'frutos_secos', sub: '2 cdas de semillas de calabaza' }
    ],
    pasos: [
      'Lavar y cortar la manzana en rebanadas.',
      'Comer alternando con las almendras, despacio y respirando entre bocados.'
    ],
    apto: ['resistencia_insulina', 'prediabetes', 'colesterol', 'higado_graso', 'migranas'],
    etiquetas: ['snack_antiansiedad', 'alto_fibra']
  },
  {
    id: 'hummus_zanahoria', comida: 'media_manana', emoji: '🥕',
    nombre: 'Hummus con bastones de zanahoria',
    descripcion: 'Proteína vegetal y crunch para media mañana.',
    ingredientes: [
      { n: '3 cdas de hummus de garbanzo', grupo: 'legumbres', sub: 'guacamole natural' },
      { n: '1 zanahoria en bastones' },
      { n: 'Pepino en bastones (opcional)' }
    ],
    pasos: ['Cortar los vegetales.', 'Untar en el hummus y disfrutar despacio.'],
    apto: ['colesterol', 'resistencia_insulina', 'prediabetes', 'candidiasis', 'higado_graso'],
    moderar: ['colon_irritable'],
    etiquetas: ['snack_antiansiedad', 'proteina_vegetal']
  },
  {
    id: 'pera_yogur', comida: 'media_manana', emoji: '🍐',
    nombre: 'Pera + yogur natural',
    descripcion: 'Fibra soluble y probióticos.',
    ingredientes: [
      { n: '1 pera con piel' },
      { n: '½ taza de yogur natural sin azúcar', grupo: 'lacteos', sub: 'yogur vegetal sin azúcar' }
    ],
    pasos: ['Picar la pera y mezclar con el yogur.', 'Agregar canela si se desea.'],
    apto: ['colesterol', 'colon_irritable', 'prediabetes', 'migranas'],
    etiquetas: ['fibra_soluble', 'fermentado']
  },
  {
    id: 'huevo_duro_tomates', comida: 'media_manana', emoji: '🥚',
    nombre: 'Huevo duro con tomates cherry',
    descripcion: 'Snack de pura proteína para cortar el antojo salado.',
    ingredientes: [
      { n: '1 huevo duro', grupo: 'huevo', sub: 'un puñado de garbanzos tostados', subGrupo: 'legumbres' },
      { n: '6 tomates cherry' },
      { n: 'Sal marina y orégano' }
    ],
    pasos: ['Pelar el huevo y partirlo.', 'Acompañar con los tomates.'],
    apto: ['resistencia_insulina', 'prediabetes', 'candidiasis', 'higado_graso', 'colesterol'],
    etiquetas: ['alto_proteina', 'snack_antiansiedad']
  },
  {
    id: 'naranja_nueces', comida: 'media_manana', emoji: '🍊',
    nombre: 'Naranja entera + nueces',
    descripcion: 'Vitamina C y omega vegetal; la fruta entera, nunca en jugo.',
    ingredientes: [
      { n: '1 naranja en gajos' },
      { n: '6 nueces', grupo: 'frutos_secos', sub: '2 cdas de semillas de girasol' }
    ],
    pasos: ['Pelar la naranja y comerla en gajos con las nueces.'],
    apto: ['colesterol', 'higado_graso', 'colon_irritable', 'migranas', 'prediabetes'],
    etiquetas: ['fibra_soluble']
  },
  {
    id: 'kefir_chia', comida: 'media_manana', emoji: '🥛',
    nombre: 'Kéfir con chía',
    descripcion: 'Doble apoyo a la microbiota.',
    ingredientes: [
      { n: '1 vaso de kéfir sin azúcar', grupo: 'lacteos', sub: 'kéfir de agua o yogur vegetal' },
      { n: '1 cda de semillas de chía' }
    ],
    pasos: ['Mezclar y dejar reposar 10 minutos antes de tomar.'],
    apto: ['candidiasis', 'colon_irritable', 'resistencia_insulina', 'prediabetes'],
    etiquetas: ['fermentado', 'microbiota']
  },

  // ================= ALMUERZOS =================
  {
    id: 'salmon_quinoa', comida: 'almuerzo', emoji: '🐟',
    nombre: 'Salmón a la plancha con quinoa y ensalada',
    descripcion: 'Plato modelo: ½ verduras, ¼ integral, ¼ proteína + grasa buena.',
    ingredientes: [
      { n: '1 filete de salmón o trucha', grupo: 'pescado', sub: 'pechuga de pollo a la plancha' },
      { n: '¾ taza de quinoa cocida' },
      { n: 'Ensalada de lechuga, pepino, zanahoria y brócoli' },
      { n: 'Aderezo: aceite de oliva + limón' }
    ],
    pasos: [
      'Cocinar el salmón a la plancha 4 minutos por lado.',
      'Servir la mitad del plato con ensalada, un cuarto con quinoa y un cuarto con el salmón.',
      'Aliñar con aceite de oliva y limón.'
    ],
    apto: ['higado_graso', 'colesterol', 'resistencia_insulina', 'prediabetes', 'candidiasis', 'migranas'],
    etiquetas: ['omega3', 'plato_modelo']
  },
  {
    id: 'lentejas_arroz_integral', comida: 'almuerzo', emoji: '🫘',
    nombre: 'Lentejas guisadas con arroz integral',
    descripcion: 'Fibra soluble + proteína vegetal, el combo cardioprotector.',
    ingredientes: [
      { n: '1 taza de lentejas guisadas con tomate y zanahoria', grupo: 'legumbres', sub: 'pollo desmechado guisado' },
      { n: '½ taza de arroz integral' },
      { n: 'Ensalada verde con aceite de oliva' }
    ],
    pasos: [
      'Guisar las lentejas con verduras y especias naturales (sin cubos industriales).',
      'Servir con el arroz integral y la ensalada.'
    ],
    apto: ['colesterol', 'higado_graso', 'prediabetes', 'resistencia_insulina'],
    moderar: ['colon_irritable'],
    etiquetas: ['fibra_soluble', 'proteina_vegetal', 'economico']
  },
  {
    id: 'pollo_batata', comida: 'almuerzo', emoji: '🍗',
    nombre: 'Pollo al horno con batata y brócoli',
    descripcion: 'Carbohidrato de bajo índice glucémico + proteína magra.',
    ingredientes: [
      { n: '1 pechuga de pollo al horno con especias' },
      { n: '1 batata mediana asada' },
      { n: '1 taza de brócoli al vapor' },
      { n: '1 cdta de aceite de oliva' }
    ],
    pasos: [
      'Hornear el pollo y la batata con especias 25–30 minutos.',
      'Cocinar el brócoli al vapor 5 minutos.',
      'Servir con un hilo de aceite de oliva.'
    ],
    apto: ['resistencia_insulina', 'prediabetes', 'candidiasis', 'higado_graso', 'colesterol', 'colon_irritable', 'migranas'],
    etiquetas: ['bajo_ig', 'plato_modelo']
  },
  {
    id: 'bowl_garbanzos', comida: 'almuerzo', emoji: '🥙',
    nombre: 'Bowl mediterráneo de garbanzos',
    descripcion: 'Inspirado en la dieta mediterránea, la más estudiada para prevenir diabetes.',
    ingredientes: [
      { n: '1 taza de garbanzos cocidos', grupo: 'legumbres', sub: 'pollo en cubos salteado' },
      { n: 'Tomate, pepino y pimentón picados' },
      { n: 'Aceitunas y aceite de oliva' },
      { n: '½ taza de quinoa o arroz integral' },
      { n: 'Limón y orégano' }
    ],
    pasos: [
      'Mezclar los garbanzos con las verduras.',
      'Agregar la quinoa, aliñar con aceite de oliva, limón y orégano.'
    ],
    apto: ['prediabetes', 'colesterol', 'resistencia_insulina', 'higado_graso'],
    moderar: ['colon_irritable'],
    etiquetas: ['mediterraneo', 'proteina_vegetal']
  },
  {
    id: 'pescado_verduras_horno', comida: 'almuerzo', emoji: '🐠',
    nombre: 'Tilapia al horno con verduras asadas',
    descripcion: 'Pescado blanco suave, apto para digestiones sensibles.',
    ingredientes: [
      { n: '1 filete de tilapia o pescado blanco', grupo: 'pescado', sub: 'pechuga de pavo' },
      { n: 'Calabacín, zanahoria y pimentón asados' },
      { n: '½ taza de arroz integral', },
      { n: 'Limón, eneldo y aceite de oliva' }
    ],
    pasos: [
      'Hornear el pescado con limón y eneldo 15 minutos.',
      'Asar las verduras con un poco de aceite de oliva.',
      'Servir todo junto con el arroz.'
    ],
    apto: ['colon_irritable', 'higado_graso', 'colesterol', 'migranas', 'candidiasis', 'prediabetes'],
    etiquetas: ['suave', 'colon_friendly']
  },
  {
    id: 'tofu_salteado', comida: 'almuerzo', emoji: '🥦',
    nombre: 'Salteado de tofu con verduras y arroz integral',
    descripcion: 'Opción 100 % vegetal alta en proteína.',
    ingredientes: [
      { n: '150 g de tofu firme en cubos', grupo: 'soya', sub: 'pollo o huevo revuelto' },
      { n: 'Brócoli, zanahoria y habichuelas' },
      { n: '½ taza de arroz integral' },
      { n: 'Jengibre y ajonjolí (sin salsas azucaradas)' }
    ],
    pasos: [
      'Dorar el tofu en sartén con poco aceite.',
      'Agregar las verduras y saltear 5 minutos.',
      'Servir sobre el arroz con jengibre y ajonjolí.'
    ],
    apto: ['colesterol', 'higado_graso', 'resistencia_insulina', 'prediabetes', 'candidiasis'],
    etiquetas: ['vegano', 'proteina_vegetal']
  },
  {
    id: 'sopa_verduras_pollo', comida: 'almuerzo', emoji: '🍲',
    nombre: 'Sopa de verduras con pollo desmechado',
    descripcion: 'Reconfortante, hidratante y suave para el colon.',
    ingredientes: [
      { n: 'Caldo natural de pollo (sin cubos industriales)' },
      { n: 'Zanahoria, calabacín, apio y ahuyama' },
      { n: '1 taza de pollo desmechado' },
      { n: 'Cilantro fresco' }
    ],
    pasos: [
      'Cocinar las verduras en el caldo hasta que ablanden.',
      'Agregar el pollo desmechado y el cilantro al final.'
    ],
    apto: ['colon_irritable', 'migranas', 'candidiasis', 'higado_graso', 'prediabetes', 'colesterol', 'resistencia_insulina'],
    etiquetas: ['suave', 'colon_friendly', 'hidratante']
  },
  {
    id: 'ensalada_atun', comida: 'almuerzo', emoji: '🥗',
    nombre: 'Ensalada completa de atún y aguacate',
    descripcion: 'Rápida, alta en omega 3 y sin cocción.',
    ingredientes: [
      { n: '1 lata de atún en agua', grupo: 'pescado', sub: 'huevo duro picado (2 unidades)', subGrupo: 'huevo' },
      { n: 'Lechuga, tomate, pepino y maíz tierno' },
      { n: '½ aguacate' },
      { n: 'Aceite de oliva y limón' }
    ],
    pasos: [
      'Mezclar las verduras con el atún escurrido.',
      'Agregar el aguacate y aliñar.'
    ],
    apto: ['colesterol', 'higado_graso', 'resistencia_insulina', 'prediabetes', 'candidiasis'],
    etiquetas: ['rapido', 'omega3']
  },

  // ================= MEDIA TARDE =================
  {
    id: 'yogur_chia_tarde', comida: 'media_tarde', emoji: '🥄',
    nombre: 'Yogur natural con semillas de chía',
    descripcion: 'El snack de las 4 pm que estabiliza el resto del día.',
    ingredientes: [
      { n: '¾ taza de yogur natural descremado sin azúcar', grupo: 'lacteos', sub: 'yogur vegetal sin azúcar' },
      { n: '1 cda de semillas de chía' },
      { n: 'Canela (opcional)' }
    ],
    pasos: ['Mezclar el yogur con la chía.', 'Dejar reposar 5 minutos y comer despacio.'],
    apto: ['resistencia_insulina', 'prediabetes', 'candidiasis', 'colesterol', 'higado_graso'],
    etiquetas: ['snack_antiansiedad', 'fermentado']
  },
  {
    id: 'te_almendras_cacao', comida: 'media_tarde', emoji: '🍵',
    nombre: 'Infusión + almendras y cacao amargo',
    descripcion: 'Para el antojo de dulce de la tarde, sin azúcar.',
    ingredientes: [
      { n: '1 infusión de manzanilla o canela' },
      { n: '10 almendras', grupo: 'frutos_secos', sub: 'semillas de calabaza tostadas' },
      { n: '2 cuadritos de chocolate ≥ 85 % cacao' }
    ],
    pasos: ['Preparar la infusión.', 'Acompañar con las almendras y el chocolate amargo, saboreando despacio.'],
    apto: ['resistencia_insulina', 'prediabetes', 'colesterol', 'migranas'],
    moderar: ['candidiasis', 'colon_irritable'],
    etiquetas: ['antojo_dulce_saludable', 'snack_antiansiedad']
  },
  {
    id: 'palitos_apio_mani', comida: 'media_tarde', emoji: '🥬',
    nombre: 'Apio con crema de maní 100 %',
    descripcion: 'Crunch + grasa buena = antojo controlado.',
    ingredientes: [
      { n: '2 tallos de apio en bastones' },
      { n: '1 cda de crema de maní 100 % (sin azúcar)', grupo: 'frutos_secos', sub: 'hummus', subGrupo: 'legumbres' }
    ],
    pasos: ['Untar el apio en la crema de maní y disfrutar.'],
    apto: ['resistencia_insulina', 'prediabetes', 'colesterol', 'candidiasis'],
    moderar: ['colon_irritable'],
    etiquetas: ['snack_antiansiedad']
  },
  {
    id: 'fruta_queso_fresco', comida: 'media_tarde', emoji: '🍓',
    nombre: 'Fresas con cuajada o queso fresco bajo en grasa',
    descripcion: 'Dulce natural + proteína láctea ligera.',
    ingredientes: [
      { n: '1 taza de fresas' },
      { n: '1 tajada de queso fresco bajo en grasa o cuajada', grupo: 'lacteos', sub: 'un puñado de nueces', subGrupo: 'frutos_secos' }
    ],
    pasos: ['Lavar las fresas y servir con el queso fresco.'],
    apto: ['resistencia_insulina', 'prediabetes', 'migranas', 'higado_graso'],
    moderar: ['candidiasis', 'colesterol'],
    etiquetas: ['antojo_dulce_saludable']
  },
  {
    id: 'garbanzos_tostados', comida: 'media_tarde', emoji: '🧆',
    nombre: 'Garbanzos tostados especiados',
    descripcion: 'Snack crocante que reemplaza los paquetes.',
    ingredientes: [
      { n: '1 taza de garbanzos cocidos', grupo: 'legumbres', sub: 'semillas de calabaza tostadas' },
      { n: 'Pimentón en polvo, comino y sal marina' },
      { n: '1 cdta de aceite de oliva' }
    ],
    pasos: [
      'Secar los garbanzos y mezclarlos con el aceite y las especias.',
      'Hornear 25 minutos a 200 °C hasta que estén crocantes.'
    ],
    apto: ['colesterol', 'prediabetes', 'resistencia_insulina', 'higado_graso'],
    moderar: ['colon_irritable'],
    etiquetas: ['snack_antiansiedad', 'reemplaza_paquetes']
  },
  {
    id: 'agua_gas_limon', comida: 'media_tarde', emoji: '🥤',
    nombre: 'Agua con gas, limón y hierbabuena',
    descripcion: 'El ritual que reemplaza la gaseosa o la cerveza.',
    ingredientes: [
      { n: '1 vaso de agua con gas' },
      { n: 'Rodajas de limón' },
      { n: 'Hojas de hierbabuena y hielo' }
    ],
    pasos: ['Servir el agua con gas bien fría con el limón y la hierbabuena.', 'Usarla como reemplazo del ritual de gaseosa, jugo o alcohol.'],
    apto: ['higado_graso', 'resistencia_insulina', 'prediabetes', 'candidiasis', 'colesterol', 'migranas', 'colon_irritable'],
    etiquetas: ['reemplaza_alcohol', 'hidratante', 'snack_antiansiedad']
  },

  // ================= CENAS =================
  {
    id: 'crema_ahuyama', comida: 'cena', emoji: '🎃',
    nombre: 'Crema de ahuyama con pollo a la plancha',
    descripcion: 'Cena ligera y caliente, sin crema de leche.',
    ingredientes: [
      { n: '2 tazas de ahuyama (calabaza) cocida' },
      { n: 'Caldo natural y especias (licuar, sin crema de leche)' },
      { n: '1 pechuga pequeña de pollo a la plancha' },
      { n: 'Ensalada de hojas verdes' }
    ],
    pasos: [
      'Licuar la ahuyama con el caldo hasta lograr una crema.',
      'Cocinar el pollo a la plancha.',
      'Servir con la ensalada verde.'
    ],
    apto: ['higado_graso', 'resistencia_insulina', 'prediabetes', 'colon_irritable', 'migranas', 'candidiasis', 'colesterol'],
    etiquetas: ['ligero', 'plato_modelo', 'colon_friendly']
  },
  {
    id: 'tortilla_calabacin', comida: 'cena', emoji: '🥒',
    nombre: 'Tortilla de calabacín y cebolla',
    descripcion: 'Cena vegetal alta en proteína.',
    ingredientes: [
      { n: '2 huevos', grupo: 'huevo', sub: 'garbanzos en harina (tortilla de garbanzo)', subGrupo: 'legumbres' },
      { n: '1 calabacín rallado' },
      { n: '¼ de cebolla (omitir en colon sensible)' },
      { n: '1 cdta de aceite de oliva' }
    ],
    pasos: [
      'Mezclar los huevos con el calabacín escurrido.',
      'Cuajar en sartén a fuego bajo por ambos lados.'
    ],
    apto: ['resistencia_insulina', 'prediabetes', 'candidiasis', 'higado_graso', 'colesterol'],
    moderar: ['colon_irritable'],
    etiquetas: ['ligero', 'rapido']
  },
  {
    id: 'pescado_pure_coliflor', comida: 'cena', emoji: '🐟',
    nombre: 'Pescado al vapor con puré de coliflor',
    descripcion: 'Baja carga glucémica y crucíferas para el hígado.',
    ingredientes: [
      { n: '1 filete de pescado blanco al vapor', grupo: 'pescado', sub: 'pechuga de pavo a la plancha' },
      { n: '2 tazas de coliflor cocida (hacer puré con aceite de oliva)' },
      { n: 'Espinacas salteadas' }
    ],
    pasos: [
      'Cocinar el pescado al vapor con limón.',
      'Hacer puré la coliflor con aceite de oliva y sal marina.',
      'Saltear las espinacas 2 minutos.'
    ],
    apto: ['higado_graso', 'resistencia_insulina', 'prediabetes', 'candidiasis', 'colesterol', 'migranas'],
    moderar: ['colon_irritable'],
    etiquetas: ['bajo_ig', 'ligero']
  },
  {
    id: 'ensalada_tibia_pollo', comida: 'cena', emoji: '🥗',
    nombre: 'Ensalada tibia de pollo y verduras asadas',
    descripcion: 'Completa pero liviana para la noche.',
    ingredientes: [
      { n: '1 taza de pollo en tiras a la plancha' },
      { n: 'Calabacín, pimentón y champiñones asados' },
      { n: 'Hojas verdes y ¼ de aguacate' },
      { n: 'Aceite de oliva y vinagre (omitir vinagre en candidiasis)' }
    ],
    pasos: [
      'Asar las verduras y el pollo.',
      'Servir sobre las hojas verdes con el aguacate y aliñar.'
    ],
    apto: ['resistencia_insulina', 'prediabetes', 'higado_graso', 'colesterol', 'migranas', 'candidiasis'],
    etiquetas: ['ligero']
  },
  {
    id: 'sopa_lentejas_cena', comida: 'cena', emoji: '🍜',
    nombre: 'Sopa ligera de lentejas rojas y zanahoria',
    descripcion: 'Fibra soluble en versión suave para la noche.',
    ingredientes: [
      { n: '¾ taza de lentejas rojas', grupo: 'legumbres', sub: 'pollo desmechado con verduras' },
      { n: 'Zanahoria y apio en cubos' },
      { n: 'Comino y cúrcuma' },
      { n: 'Caldo natural' }
    ],
    pasos: [
      'Cocinar todo junto 20 minutos hasta que la lenteja se deshaga.',
      'Servir caliente con cilantro.'
    ],
    apto: ['colesterol', 'prediabetes', 'higado_graso', 'resistencia_insulina'],
    moderar: ['colon_irritable'],
    etiquetas: ['fibra_soluble', 'economico']
  },
  {
    id: 'tacos_lechuga', comida: 'cena', emoji: '🌮',
    nombre: 'Tacos de lechuga con pavo molido',
    descripcion: 'Antojo de comida rápida en versión saludable.',
    ingredientes: [
      { n: '150 g de pavo o pollo molido salteado con especias' },
      { n: 'Hojas grandes de lechuga (como tortilla)' },
      { n: 'Tomate, cilantro y limón' },
      { n: '¼ de aguacate' }
    ],
    pasos: [
      'Saltear el pavo con especias mexicanas naturales.',
      'Armar los tacos usando las hojas de lechuga como base.',
      'Servir con pico de gallo y aguacate.'
    ],
    apto: ['resistencia_insulina', 'prediabetes', 'candidiasis', 'higado_graso', 'colesterol', 'migranas'],
    etiquetas: ['antojo_salado_saludable', 'bajo_ig'],
  },
  {
    id: 'revuelto_champinones', comida: 'cena', emoji: '🍄',
    nombre: 'Revuelto de champiñones, espinaca y huevo',
    descripcion: 'Cena exprés en 10 minutos.',
    ingredientes: [
      { n: '2 huevos', grupo: 'huevo', sub: 'tofu firme desmenuzado', subGrupo: 'soya' },
      { n: '1 taza de champiñones laminados' },
      { n: '1 taza de espinaca' },
      { n: '1 cdta de aceite de oliva' }
    ],
    pasos: [
      'Saltear los champiñones, agregar la espinaca.',
      'Añadir los huevos batidos y revolver a fuego bajo.'
    ],
    apto: ['resistencia_insulina', 'prediabetes', 'higado_graso', 'colesterol', 'migranas'],
    moderar: ['candidiasis', 'colon_irritable'],
    etiquetas: ['rapido', 'ligero']
  }
];
