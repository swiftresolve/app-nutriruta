// Configuración pública de Savibra.
// La clave "publishable" está diseñada para usarse en el cliente:
// los datos están protegidos por Row Level Security (RLS) en Supabase.
export const SUPABASE_URL = 'https://rlcnxhykwfeasehmuhqe.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jPGbbXPuwSggBMgiwY3EWw_5ey8BJgC';

// Checkout de Hotmart: pega aquí las URLs de pago de cada plan cuando los
// crees en Hotmart (Producto → Enlaces de divulgación / checkout).
// Mientras estén vacías, la app activa Premium como cortesía de lanzamiento.
export const HOTMART_CHECKOUT = {
  mensual: '',
  anual: ''
};
