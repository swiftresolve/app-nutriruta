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

// Checkout de los paquetes de NutriCoins -- producto "NutriRuta —
// NutriCoins" (ID 8493109) en Hotmart, un producto de compra ÚNICA
// aparte del Premium, con 4 ofertas (una por paquete). El monto de
// NutriCoins que se acredita por cada uno lo define
// HOTMART_OFERTA_NUTRICOINS en el edge function hotmart-webhook (mapea el
// código "off" al número de monedas) -- si cambias la cantidad de un
// paquete o le agregas uno nuevo, cambia también ese secreto para que
// coincida. Si algún valor volviera a quedar en `null`, el botón de ese
// paquete en la app muestra "Muy pronto" en vez de abrir Hotmart (ver
// abrirComprarNutricoins en app.js).
export const HOTMART_CHECKOUT_NUTRICOINS = {
  100: 'https://pay.hotmart.com/A107551732U?off=4vfxe89t&checkoutMode=6',
  500: 'https://pay.hotmart.com/A107551732U?off=bfe78o3u&checkoutMode=6',
  1000: 'https://pay.hotmart.com/A107551732U?off=bggsldu9&checkoutMode=6',
  2500: 'https://pay.hotmart.com/A107551732U?off=mqtiew11&checkoutMode=6'
};

// Llave pública VAPID para notificaciones push (Web Push estándar).
// La privada vive solo en el servidor (secreto de la Edge Function), nunca aquí.
export const VAPID_PUBLIC_KEY = 'BP7q0wE_QDtHTryoNzPGrIJu7zg8GbdFxv1yjxdJuF4tMnmHBWtKCIjA49ooFMp3nVxP0OiBjBeS2tNmJTO-FVg';
