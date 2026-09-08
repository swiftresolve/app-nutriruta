// Categorías nutricionales por palabra clave -- clasificación básica de
// grupos de alimentos (qué es una fuente de proteína, cuál es un vegetal,
// etc.), no conteo de calorías ni macros en gramos (NutriRuta nunca hace
// eso). Se usa para asegurar que el menú del día, para CUALQUIER perfil
// (incluida una persona sin condiciones especiales), cubra proteína y
// vegetales/fruta en las comidas principales -- ver asegurarCobertura() en
// menu.js. Cada lista son alimentos reales y bien conocidos, sin inventar
// ninguna categoría dudosa (ver [[feedback-solo-info-comprobada]]).
export const CATEGORIAS_ALIMENTOS = {
  proteina: [
    'huevo', 'huevos', 'clara de huevo', 'claras de huevo', 'pollo', 'pechuga', 'pescado', 'atún', 'atun',
    'salmón', 'salmon', 'tilapia', 'camarones', 'carne', 'res', 'cerdo', 'pavo', 'lenteja', 'lentejas',
    'garbanzo', 'garbanzos', 'frijol', 'frijoles', 'queso', 'queso fresco', 'queso costeño', 'queso costeno',
    'requesón', 'requeson', 'yogur griego', 'yogurt griego', 'tofu', 'proteína', 'proteina', 'kumis'
  ],
  vegetal: [
    'lechuga', 'espinaca', 'espinacas', 'tomate', 'pepino', 'zanahoria', 'brócoli', 'brocoli', 'calabacín',
    'calabacin', 'pimentón', 'pimenton', 'cebolla', 'repollo', 'coliflor', 'apio', 'rúgula', 'arugula',
    'acelga', 'champiñones', 'champinones', 'verduras', 'ensalada', 'habichuela', 'habichuelas', 'ahuyama'
  ],
  carbohidrato: [
    'arroz', 'papa', 'papas', 'yuca', 'plátano', 'platano', 'avena', 'pan integral', 'pan', 'quinoa',
    'pasta integral', 'arepa', 'tortilla', 'maíz', 'maiz', 'camote', 'batata'
  ]
};

// Detecta qué categorías cubre una receta según sus ingredientes (acepta
// tanto el catálogo curado, con objetos { n: '2 huevos' }, como recetas
// propias/generadas por IA, con strings sueltos).
export function categoriasDeIngredientes(ingredientes) {
  const textos = (ingredientes || []).map((i) => (typeof i === 'string' ? i : i.n || ''));
  const quitarAcentos = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const texto = quitarAcentos(textos.join(' '));
  const presentes = new Set();
  for (const [categoria, palabras] of Object.entries(CATEGORIAS_ALIMENTOS)) {
    if (palabras.some((p) => texto.includes(quitarAcentos(p)))) {
      presentes.add(categoria);
    }
  }
  return presentes;
}
