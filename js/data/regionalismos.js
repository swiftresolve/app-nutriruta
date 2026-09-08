// "Idioma de alimentos" (Ajustes → Interfaz y preferencias) -- referencia
// real: Fitia separa "Idioma de Interfaz" de "Idioma de Alimentos" (son
// cosas distintas). El catálogo de recetas está escrito en español de
// Colombia; esto NO traduce a otro idioma, solo cambia el nombre de
// alimentos que sí varían de país a país dentro del español, para que se
// sientan familiares (ej. una usuaria en Argentina lee "palta", no
// "aguacate").
//
// Solo términos BIEN CONOCIDOS y SIN AMBIGÜEDAD real dentro del propio
// catálogo -- nunca una variante inventada o dudosa (ver
// [[feedback-solo-info-comprobada]]). "banano" -> "plátano" para
// México/España se dejó FUERA a propósito: en Colombia "plátano" ya
// nombra al plátano para cocinar (patacones, tajadas), que también
// aparece en el catálogo -- usar la misma palabra para dos alimentos
// distintos en la misma app confundiría más de lo que ayuda.
// nombre es el valor por defecto (sin la aclaración de "como está escrito
// hoy" para Colombia, que se arma aparte con t() en settings.js).
export const PAISES_ALIMENTOS = [
  { id: 'co', nombre: 'Colombia' },
  { id: 'mx', nombre: 'México' },
  { id: 'ar', nombre: 'Argentina' },
  { id: 'es', nombre: 'España' },
  { id: 'pe', nombre: 'Perú' }
];

// Clave = término canónico tal como está escrito en recipes.js (español
// de Colombia). Valor = variante por país, solo donde de verdad cambia.
export const REGIONALISMOS = {
  aguacate: { ar: 'palta', pe: 'palta' },
  aguacates: { ar: 'paltas', pe: 'paltas' },
  maní: { mx: 'cacahuate', es: 'cacahuete' },
  papa: { es: 'patata' },
  papas: { es: 'patatas' },
  arveja: { es: 'guisante', mx: 'chícharo' },
  arvejas: { es: 'guisantes', mx: 'chícharos' },
  fresa: { ar: 'frutilla' },
  fresas: { ar: 'frutillas' },
  durazno: { es: 'melocotón' },
  duraznos: { es: 'melocotones' },
  frijol: { ar: 'poroto', es: 'judía' },
  frijoles: { ar: 'porotos', es: 'judías' },
  banano: { ar: 'banana' },
  bananos: { ar: 'bananas' }
};
