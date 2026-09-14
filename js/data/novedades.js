// Registro de novedades visible para las usuarias (Ajustes -> Novedades).
// Se agrega una entrada corta cada vez que se publica una mejora, así sea
// mínima -- pedido explícito: que la usuaria vea que la app sigue viva y
// mejorando, no solo cuando hay una función grande. Orden: más reciente
// primero. `imagen` es opcional (ruta dentro de img/novedades/, una
// captura de cómo quedó la interfaz que cambió).
export const NOVEDADES = [
  {
    id: '2026-09-14-checkout-marca',
    fecha: '2026-09-14',
    titulo: 'Pantalla de pago con la marca de NutriRuta',
    descripcion: 'Al comprar NutriCoins o Premium, la pestaña de pago ya no se ve negra mientras carga -- ahora muestra el ícono de NutriRuta con los colores de la app.'
  },
  {
    id: '2026-09-13-insignias-puntualidad',
    fecha: '2026-09-13',
    titulo: 'Insignias de puntualidad',
    descripcion: 'Nuevas insignias en Logros por comer a tu hora configurada varios días seguidos: bronce, plata, oro y diamante, una por cada comida y una especial por el día completo.'
  },
  {
    id: '2026-09-12-ruti-animo',
    fecha: '2026-09-12',
    titulo: 'Ruti ahora tiene ánimo propio',
    descripcion: 'En "Tu paso de hoy", Ruti refleja cómo vas con tus comidas y tu agua del día, con una frase distinta cada vez -- tócala si tiene hambre y te ayuda a registrar rápido.'
  },
  {
    id: '2026-09-10-camara',
    fecha: '2026-09-10',
    titulo: 'Arreglamos la cámara de registrar comida',
    descripcion: 'La cámara en vivo dejó de congelarse después de tomar la foto en varios celulares.'
  }
];
