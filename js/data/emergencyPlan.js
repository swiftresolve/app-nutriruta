// Plan de 7 días: la respuesta inmediata para quien acaba de recibir una
// noticia de salud y quiere empezar hoy mismo, sin esperar. Gratis para
// todas las cuentas — es la puerta de entrada; la Misión 12 semanas
// (Premium) es el siguiente paso para quien quiere sostenerlo en el tiempo.
export const EMERGENCY_PLAN = {
  id: 'plan_7_dias',
  nombre: 'Plan de 7 días',
  descripcion: 'Si te acaban de hablar de tu glucosa, tu colesterol o tu hígado, no tienes que esperar al lunes. Empieza hoy, un paso concreto por día.',
  dias: [
    {
      n: 1, emoji: '🥤', titulo: 'Fuera el azúcar líquida',
      objetivo: 'Dar el primer paso sin esperar exámenes ni preparación especial.',
      acciones: [
        'Cambia cualquier gaseosa, jugo o té embotellado de hoy por agua o infusión sin azúcar.',
        'Guarda lejos (no hace falta botar) lo que tengas de esas bebidas en casa.',
        'Bebe un vaso de agua al despertar.'
      ],
      reflexion: '¿Qué bebida te costó más cambiar hoy? Anótalo: es información valiosa sobre ti.'
    },
    {
      n: 2, emoji: '🍽️', titulo: 'Arma tu plato modelo',
      objetivo: 'Un solo cambio estructural que ordena toda la comida, sin contar calorías.',
      acciones: [
        'En el almuerzo y la cena: medio plato de verduras, un cuarto de integral, un cuarto de proteína.',
        'Empieza a comer por las verduras.',
        'No necesitas báscula ni contar nada: solo mira el plato.'
      ],
      reflexion: '¿Sentiste diferencia en tu saciedad o tu energía después de comer así?'
    },
    {
      n: 3, emoji: '💧', titulo: 'Tu meta de agua, sin excusas',
      objetivo: 'Hidratarte de verdad, no solo cuando ya tienes sed.',
      acciones: [
        'Registra tu meta de agua en la app hoy mismo.',
        'Ten una botella visible en tu espacio de trabajo.',
        'Un vaso de agua antes de cada comida.'
      ],
      reflexion: '¿Cómo estuvo tu energía y tu digestión hoy, comparado con ayer?'
    },
    {
      n: 4, emoji: '💚', titulo: 'Prepara tu snack de emergencia',
      objetivo: 'Tener lista una alternativa ANTES de que llegue el antojo, no durante.',
      acciones: [
        'Elige un snack saludable de la app y ten sus ingredientes en casa.',
        'Nota a qué hora del día te suele dar más ansiedad por comer.',
        'Si llega un antojo hoy, usa el botón SOS antes de decidir.'
      ],
      reflexion: '¿A qué hora llegó tu antojo, si llegó? Empieza a notar el patrón.'
    },
    {
      n: 5, emoji: '🚶‍♀️', titulo: 'Muévete, sin gimnasio',
      objetivo: 'Activar el cuerpo sin que se sienta como una obligación imposible.',
      acciones: [
        'Camina al menos 20–30 minutos hoy, en el momento que puedas.',
        'Si puedes, camina después de tu comida más grande.',
        'No necesitas ropa deportiva: cualquier movimiento cuenta.'
      ],
      reflexion: '¿Cómo te sentiste después de moverte? Anótalo para tus días difíciles.'
    },
    {
      n: 6, emoji: '🔍', titulo: 'Lee las etiquetas',
      objetivo: 'Reconocer el azúcar y los ultraprocesados escondidos en lo que ya comes.',
      acciones: [
        'Revisa 2 o 3 productos que tengas en casa y busca "azúcar" en la lista de ingredientes.',
        'Si el azúcar aparece entre los primeros 3 ingredientes, busca una alternativa.',
        'Prefiere alimentos con pocos ingredientes, todos reconocibles.'
      ],
      reflexion: '¿Qué producto te sorprendió más al leer su etiqueta?'
    },
    {
      n: 7, emoji: '🏁', titulo: 'Balance y siguiente paso',
      objetivo: 'Reconocer lo que lograste en una semana y decidir cómo seguir.',
      acciones: [
        'Repasa tus 6 días: ¿qué cambio fue más fácil? ¿cuál más difícil?',
        'Agenda o confirma tu próximo control con tu profesional de salud.',
        'Decide si quieres seguir con la Misión 12 semanas para volverlo tu nuevo estilo de vida.'
      ],
      reflexion: 'Compárate solo contigo misma hace 7 días. ¿Qué cambió?'
    }
  ]
};
