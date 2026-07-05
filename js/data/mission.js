// Misión 12 semanas: programa progresivo para resetear hábitos y reducir
// riesgo de hígado graso, diabetes y colesterol.
export const MISSION = {
  id: 'mision_12_semanas',
  nombre: 'Misión 12 semanas',
  descripcion: 'Un cambio por semana. Doce semanas para transformar tu glucosa, tu hígado y tu corazón, sin dietas extremas.',
  semanas: [
    {
      n: 1, titulo: 'Cero azúcar líquido', emoji: '🥤',
      objetivo: 'Eliminar gaseosas, jugos (incluso "naturales" industriales) y té embotellado.',
      acciones: ['Reemplaza cada gaseosa por agua con gas + limón', 'Café e infusiones sin azúcar', 'Fruta entera cuando quieras algo dulce'],
      reflexion: '¿En qué momentos del día te pedía el cuerpo bebidas dulces? ¿Qué las disparaba?'
    },
    {
      n: 2, titulo: 'Proteína en el desayuno', emoji: '🍳',
      objetivo: 'Desayunar proteína todos los días para estabilizar la glucosa desde la mañana.',
      acciones: ['Huevo, yogur natural, tofu o legumbres al desayuno', 'Deja listo el desayuno la noche anterior si sales temprano', 'Nada de desayunar solo pan o galletas'],
      reflexion: '¿Notas diferencia en tu hambre y energía a media mañana?'
    },
    {
      n: 3, titulo: 'Meta de agua diaria', emoji: '💧',
      objetivo: 'Llegar a tu meta de agua (6–8 vasos) todos los días de la semana.',
      acciones: ['Un vaso de agua al despertar', 'Botella visible en tu espacio de trabajo', 'Registra tus vasos en NutriRuta cada día'],
      reflexion: '¿Cambia algo en tu digestión, tu piel o tus dolores de cabeza?'
    },
    {
      n: 4, titulo: 'Medio plato de verduras', emoji: '🥗',
      objetivo: 'Almuerzo y cena con la mitad del plato en verduras.',
      acciones: ['Empieza a comer por las verduras', 'Ten verduras lavadas y listas en la nevera', 'Suma un color nuevo de verdura esta semana'],
      reflexion: '¿Qué verduras nuevas descubriste que sí disfrutas?'
    },
    {
      n: 5, titulo: 'Adiós harinas blancas', emoji: '🍞',
      objetivo: 'Cambiar pan blanco, pasta blanca y arroz blanco por versiones integrales.',
      acciones: ['Pan 100 % integral o de masa madre', 'Arroz integral o quinoa en tus comidas', 'Si comes fuera, pide la opción integral o dobla la verdura'],
      reflexion: '¿Sientes más saciedad con integrales? ¿Menos antojos en la tarde?'
    },
    {
      n: 6, titulo: 'Movimiento diario', emoji: '🚶‍♀️',
      objetivo: 'Caminar 30 minutos al día, 5 días de la semana.',
      acciones: ['Agenda la caminata como una cita contigo', 'Camina después de la comida más grande del día', 'Invita a alguien: el hábito acompañado dura más'],
      reflexion: 'Caminar tras las comidas reduce el pico de glucosa. ¿Cómo te sientes al terminar?'
    },
    {
      n: 7, titulo: 'Semana sin fritos', emoji: '🍟',
      objetivo: 'Cero frituras: todo al horno, plancha, vapor o air fryer.',
      acciones: ['Batata al horno en vez de papas fritas', 'Pollo a la plancha en vez de apanado', 'Garbanzos tostados en vez de paquetes'],
      reflexion: 'Tu hígado procesa mejor las grasas de horno y plancha. ¿Extrañaste los fritos menos de lo esperado?'
    },
    {
      n: 8, titulo: 'Fermentados y fibra', emoji: '🦠',
      objetivo: 'Alimentar tu microbiota: un fermentado al día + 25 g de fibra.',
      acciones: ['Yogur natural o kéfir sin azúcar a diario', 'Legumbres al menos 3 veces esta semana', 'Semillas de chía o linaza en el desayuno'],
      reflexion: '¿Cómo está tu digestión comparada con la semana 1?'
    },
    {
      n: 9, titulo: 'Cena ligera y temprana', emoji: '🌙',
      objetivo: 'Cenar al menos 2–3 horas antes de dormir, con cenas livianas.',
      acciones: ['Sopa o crema de verduras + proteína magra', 'Si da hambre tarde: infusión o yogur natural', 'Pantallas fuera de la mesa'],
      reflexion: '¿Duermes mejor? ¿Amaneces con más hambre real (buena señal)?'
    },
    {
      n: 10, titulo: 'Manejo del antojo', emoji: '💚',
      objetivo: 'Usar el botón SOS en cada antojo y registrar el resultado.',
      acciones: ['Pausa de agua + 5 respiraciones ante cada antojo', 'Ten tu snack anti-ansiedad preparado a tu hora crítica', 'Registra todo: cada dato te enseña algo'],
      reflexion: 'Mira tu historial: ¿a qué hora y con qué emoción llegan tus antojos?'
    },
    {
      n: 11, titulo: 'Dormir para sanar', emoji: '😴',
      objetivo: 'Dormir 7–8 horas con horario fijo toda la semana.',
      acciones: ['Hora fija para acostarte y levantarte', 'Sin pantallas 30 minutos antes de dormir', 'Habitación oscura y fresca'],
      reflexion: 'Dormir bien regula las hormonas del hambre. ¿Notas menos antojos esta semana?'
    },
    {
      n: 12, titulo: 'Tu nuevo estilo de vida', emoji: '🏆',
      objetivo: 'Integrar todo: una semana completa viviendo tus nuevos hábitos.',
      acciones: ['Repasa qué hábitos ya se sienten naturales', 'Elige los 3 que más te cambiaron y protégelos', 'Agenda tus exámenes de control con tu profesional de salud'],
      reflexion: 'Compárate solo con tu semana 1. ¿Quién eres hoy con tu comida, tu energía y tu cuerpo?'
    }
  ]
};
