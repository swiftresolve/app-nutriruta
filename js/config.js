// Configuración pública de NutriRuta.
// La clave "publishable" está diseñada para usarse en el cliente:
// los datos están protegidos por Row Level Security (RLS) en Supabase.
export const SUPABASE_URL = 'https://rlcnxhykwfeasehmuhqe.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jPGbbXPuwSggBMgiwY3EWw_5ey8BJgC';

// Checkout de Hotmart (Producto NutriRuta Premium, ID 8074107).
export const HOTMART_CHECKOUT = {
  mensual: 'https://pay.hotmart.com/D106628820F?off=je8nuijj&checkoutMode=6',
  anual: 'https://pay.hotmart.com/D106628820F?off=ti1e49b3&checkoutMode=6'
};

// Llave pública VAPID para notificaciones push (Web Push estándar).
// La privada vive solo en el servidor (secreto de la Edge Function), nunca aquí.
export const VAPID_PUBLIC_KEY = 'BPS6eFYYD2r3tO60JZxKq18XxDgjCrQiE0nM-36dm-HaanX7O67NzG3oF29Fjj2YTlRH2snSqlLtJZaFgYHEG7s';
