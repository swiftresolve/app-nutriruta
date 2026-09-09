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

// Checkout de los paquetes de NutriCoins -- cada uno es un producto de
// compra ÚNICA aparte del Premium, creado en Hotmart. Mientras el valor
// siga siendo `null`, el botón de ese paquete en la app muestra "Muy
// pronto" en vez de abrir Hotmart (ver abrirComprarNutricoins en app.js) --
// así no hace falta tocar código de nuevo, solo pegar aquí el link de pago
// ("off=...") una vez creado cada producto/oferta en el panel de Hotmart
// (Productos → Crear producto → Digital → pago único, uno POR paquete, o
// un mismo producto con 4 ofertas distintas, igual que mensual/anual
// arriba comparten producto 8074107 con dos códigos "off" distintos).
// El monto de NutriCoins que se acredita por cada uno lo define
// HOTMART_OFERTA_NUTRICOINS en el edge function hotmart-webhook (mapea el
// código "off" al número de monedas) -- si cambias la cantidad aquí,
// cambia también ese secreto para que coincida.
export const HOTMART_CHECKOUT_NUTRICOINS = {
  100: null,
  500: null,
  1000: null,
  2500: null
};

// Llave pública VAPID para notificaciones push (Web Push estándar).
// La privada vive solo en el servidor (secreto de la Edge Function), nunca aquí.
export const VAPID_PUBLIC_KEY = 'BP7q0wE_QDtHTryoNzPGrIJu7zg8GbdFxv1yjxdJuF4tMnmHBWtKCIjA49ooFMp3nVxP0OiBjBeS2tNmJTO-FVg';
