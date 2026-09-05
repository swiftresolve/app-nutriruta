// Cliente Supabase: autenticación con JWT (access + refresh token rotativo)
// y acceso a datos protegido por Row Level Security.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signUp(email, password, nombre) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } }
  });
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

// Login con Google (como Fitia) -- redirige a Google y de vuelta a la app
// con la sesión ya creada. Requiere activar el provider "Google" en
// Supabase (Authentication → Providers) con credenciales OAuth de Google
// Cloud Console -- sin eso, Supabase responde con error "provider is not
// enabled" al presionar el botón, aunque el código ya esté listo.
export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

// Enlace de "olvidé mi contraseña": lleva a la misma pantalla de crear
// contraseña que el enlace de invitación de Hotmart (resetPassword.js),
// pero con su propia marca "?reset=1" -- así app.js puede distinguir
// "acabas de comprar" de "olvidaste tu clave" y mostrar el texto
// correcto en cada caso (antes ambos mostraban "tu compra ya está
// confirmada", que no aplica si solo olvidaste la contraseña).
export async function requestPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?reset=1`
  });
}

// --- Perfil remoto (fila propia en public.profiles, RLS: solo el dueño) ---

export async function fetchProfile() {
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function pushProfileState(state, nombre) {
  const session = await getSession();
  if (!session) return;
  const row = { id: session.user.id, state };
  // Nunca borrar el nombre guardado (p. ej. el dado al registrarse) con un vacío.
  if (nombre) row.nombre = String(nombre).slice(0, 60);
  const { error } = await supabase.from('profiles').upsert(row);
  if (error) throw error;
}

// --- Reseñas (calificación 1-5 + mini reseña opcional) ---
// Una por usuaria (se puede editar), visible en vivo en la landing vía la
// vista pública resenas_publicas — nunca expone user_id ni correo.
export async function fetchMyResena() {
  const { data, error } = await supabase.from('resenas').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitResena(calificacion, texto, nombreMostrado) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  const row = {
    user_id: session.user.id,
    calificacion,
    texto: texto ? String(texto).slice(0, 300) : null,
    nombre_mostrado: (nombreMostrado || 'Usuario de NutriRuta').slice(0, 60)
  };
  const { error } = await supabase.from('resenas').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

// --- Foto de perfil ---
// Se guarda siempre como "<uid>.jpg" en el bucket público "avatars" — el
// nombre fijo hace que la política de Storage sea simple (cada quien solo
// puede escribir su propio archivo) y que la URL pública sea predecible sin
// necesitar guardar nada más en profiles. El archivo se recorta/comprime en
// el cliente antes de subir para no depender de límites de tamaño del lado
// del servidor ni gastar espacio de más.
const AVATAR_MAX_BYTES = 15 * 1024 * 1024; // 15 MB: una foto de cámara normal, no un archivo cualquiera

export async function uploadAvatar(file) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  if (file.size > AVATAR_MAX_BYTES) throw new Error('La imagen es demasiado grande (máximo 15 MB).');
  const blob = await toSquareJpeg(file, 320);
  const path = `${session.user.id}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    contentType: 'image/jpeg', upsert: true
  });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`; // cache-buster: la URL base es siempre la misma
}

export function avatarUrlFor(userId) {
  const { data } = supabase.storage.from('avatars').getPublicUrl(`${userId}.jpg`);
  return data.publicUrl;
}

// --- Foto de comida (diario visual) ---
// Un archivo por comida por día ("<uid>/<fecha>-<mealId>.jpg"): volver a
// registrar la misma comida el mismo día sobreescribe la foto en vez de
// acumular archivos huérfanos.
export async function uploadComidaFoto(blob, mealId, dateStr) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  const path = `${session.user.id}/${dateStr}-${mealId}.jpg`;
  const { error } = await supabase.storage.from('comidas').upload(path, blob, {
    contentType: 'image/jpeg', upsert: true
  });
  if (error) throw error;
  const { data } = supabase.storage.from('comidas').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

function toSquareJpeg(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen.'))), 'image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Imagen inválida.'));
    img.src = URL.createObjectURL(file);
  });
}

export async function downgradeToFree() {
  // El plan Premium ya no se activa desde el cliente (columnas protegidas):
  // lo activa el webhook de Hotmart al confirmarse el pago. Solo bajar a
  // gratis sigue siendo una acción legítima que la propia usuaria controla.
  const { error } = await supabase.rpc('bajar_a_gratuito');
  if (error) throw error;
}

// Semanas de la misión: el servidor solo entrega las que el plan permite
// (semana 1 para todos; 2–12 únicamente con Premium vigente).
export async function fetchMissionWeeks() {
  const { data, error } = await supabase
    .from('mission_weeks')
    .select('n, emoji, titulo, objetivo, acciones, reflexion, gratis')
    .order('n');
  if (error) throw error;
  return data || [];
}

// Índice de la misión (solo n/emoji/título/gratis, nunca el contenido):
// para pintar el mapa completo de 12 semanas también a cuentas gratuitas,
// con las semanas premium bloqueadas. Es una función con permisos solo
// para cuentas autenticadas, no una tabla/vista abierta.
export async function fetchMissionIndex() {
  const { data, error } = await supabase.rpc('mission_indice');
  if (error) throw error;
  return data || [];
}

// --- Pregúntale a tu guía (asistente IA, Premium) ---
// Todo pasa por la Edge Function: valida Premium vigente y la cuota
// mensual en el servidor, y es la única vía con permiso de escribir en
// ai_conversations (la tabla no tiene políticas RLS para clientes).
export async function fetchGuideHistory(conversationId) {
  const { data, error } = await supabase.functions.invoke('ai-assistant', { body: { action: 'history', conversationId } });
  if (error) throw error;
  return data;
}

// Menú hamburguesa "Historial de SuSana" -- una fila por conversación,
// título = su primer mensaje (igual que Fitia Coach).
export async function listGuideConversations() {
  const { data, error } = await supabase.functions.invoke('ai-assistant', { body: { action: 'list_conversations' } });
  if (error) throw error;
  return data.conversations;
}

// Ícono de lápiz del historial -- solo pide un id nuevo, la fila real se
// crea recién cuando se manda el primer mensaje (ver askGuide).
export async function newGuideConversation() {
  const { data, error } = await supabase.functions.invoke('ai-assistant', { body: { action: 'new_conversation' } });
  if (error) throw error;
  return data.conversationId;
}

// --- Crear con IA (Recetario) ---
// Genera UNA receta vía Edge Function (generate-recipe): valida saldo de
// NutriCoins en el servidor antes de llamar a la IA, pero el descuento real
// del saldo lo hace el cliente tras una respuesta exitosa (ver
// gastarNutricoins en store.js) -- mismo modelo de confianza que el resto
// de la moneda de la app.
async function invocarGenerarReceta(body) {
  const { data, error } = await supabase.functions.invoke('generate-recipe', { body });
  if (error) {
    let errBody = null;
    try { errBody = await error.context.clone().json(); } catch { /* respuesta no era JSON */ }
    if (errBody) {
      const e = new Error(errBody.message || errBody.error || 'No pudimos generar la receta.');
      e.code = errBody.error;
      throw e;
    }
    throw error;
  }
  return data.receta;
}

export async function generarRecetaIA(comida, notas) {
  return invocarGenerarReceta({ comida, modo: 'texto', notas });
}

// "Desde una foto": la propia foto puede ser (a) una receta escrita/
// impresa -- se transcribe fiel -- o (b) el plato ya preparado -- se
// reconstruye una receta razonable, marcada `reconstruida: true` para que
// la app avise que es una estimación, nunca una fuente verificada.
export async function generarRecetaDesdeFoto(comida, imagenBase64, imagenMediaType) {
  return invocarGenerarReceta({ comida, modo: 'foto', imagenBase64, imagenMediaType });
}

// "Desde un enlace": el servidor descarga la página (nunca el navegador,
// por CORS/CSP) y estructura solo lo que dice ese texto real.
export async function generarRecetaDesdeEnlace(comida, url) {
  return invocarGenerarReceta({ comida, modo: 'enlace', url });
}

// --- Notificaciones push ---
// El cliente solo puede crear/borrar SU PROPIA suscripción (RLS); nunca leer
// suscripciones de nadie, ni siquiera la propia de vuelta. El envío real lo
// hace la Edge Function push-notify con service_role, disparada por cron.
export async function savePushSubscription(sub) {
  const session = await getSession();
  if (!session) return;
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').insert({
    user_id: session.user.id,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth
  });
  // Si ya existía (endpoint único), no es un error real: mismo dispositivo re-suscribiendo.
  if (error && error.code !== '23505') throw error;
}

export async function deletePushSubscription(endpoint) {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw error;
}

// --- Panel de administración ---
// admin_dashboard() valida ella misma (en el servidor) si quien pregunta
// está en admin_emails; para cualquier otra cuenta lanza una excepción y
// no entrega nada. El cliente nunca decide quién es admin, solo pregunta.
export async function fetchAdminDashboard() {
  const { data, error } = await supabase.rpc('admin_dashboard');
  if (error) throw error;
  return data;
}

// Chequeo liviano para decidir si mostrar el link al panel de admin en
// Ajustes (antes se mostraba a cualquier usuaria, aunque el panel en sí
// ya rechazaba a quien no fuera admin al pedir los datos). No reemplaza
// ese chequeo real -- es solo para no exhibir el botón de más.
export async function checkIsAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return data === true;
}

// --- Liga semanal de gemas ---
// liga_estado() (SECURITY DEFINER) une a la usuaria a un grupo si aún no
// tiene uno para esta semana (liga_unirme lazy) y devuelve hasta 20
// filas {user_id, nombre, gemas_semana, es_yo} de SU grupo, ordenadas
// por gemas descendente. liga_grupo_id/liga_nivel viven en columnas
// propias de profiles (no en el state JSONB) para que el cliente no
// pueda tocarlas -- se leen aparte, con la misma política RLS de
// "leer mi propia fila" que ya usa el resto de la app.
export async function fetchLigaEstado() {
  const { data, error } = await supabase.rpc('liga_estado');
  if (error) throw error;
  return data ?? [];
}

export async function fetchMiNivelLiga() {
  const session = await getSession();
  if (!session) return 1;
  const { data, error } = await supabase.from('profiles').select('liga_nivel').eq('id', session.user.id).maybeSingle();
  if (error) return 1;
  return data?.liga_nivel ?? 1;
}

// Código propio de referido (se crea la primera vez que se pide, ver
// mi_codigo_referido() en la migración add_referidos).
export async function miCodigoReferido() {
  const { data, error } = await supabase.rpc('mi_codigo_referido');
  if (error) throw error;
  return data;
}

// Canjear el código de un amigo desde Ajustes (para quien ya tiene
// cuenta y no llegó por un link "?ref="). Solo valida que exista y no
// sea el propio -- ver validar_codigo_referido() en la migración.
export async function validarCodigoReferido(codigo) {
  const { data, error } = await supabase.rpc('validar_codigo_referido', { p_codigo: codigo });
  if (error) throw error;
  return data === true;
}

// Activar/quitar Premium a mano desde el panel de admin (ver
// admin_set_plan en la migración: valida admin_emails ella misma y deja
// registro con monto 0 en pagos para poder distinguir esto de un cobro
// real de Hotmart en la auditoría de "premium sin pago").
export async function adminSetPlan(userId, plan, periodo = null) {
  const { error } = await supabase.rpc('admin_set_plan', { p_user_id: userId, p_plan: plan, p_periodo: periodo });
  if (error) throw error;
}

export async function askGuide(message, conversationId) {
  const { data, error } = await supabase.functions.invoke('ai-assistant', { body: { action: 'send', message, conversationId } });
  if (error) {
    // supabase-js expone el cuerpo de error en error.context (un Response ya
    // parcialmente leído por el SDK); hay que clonarlo antes de leerlo de nuevo,
    // o .json() falla con "body stream already read" y perdemos el mensaje.
    let body = null;
    try { body = await error.context.clone().json(); } catch { /* respuesta no era JSON */ }
    if (body) {
      const e = new Error(body.message || body.error || 'No se pudo enviar tu pregunta.');
      e.code = body.error;
      e.resetDate = body.resetDate;
      throw e;
    }
    throw error;
  }
  return data;
}

// Identifica alimentos en una foto o un texto libre (dictado por voz o
// escrito) — no cuenta contra la cuota de SuSana ni requiere Premium (ver
// log-meal). Devuelve la lista cruda de nombres; quien llama la muestra
// editable antes de guardarla, nunca se guarda sin confirmar.
async function invokeLogMeal(body) {
  const { data, error } = await supabase.functions.invoke('log-meal', { body });
  if (error) {
    let errBody = null;
    try { errBody = await error.context.clone().json(); } catch { /* no era JSON */ }
    throw new Error(errBody?.error || 'No pudimos analizar eso. Intenta de nuevo.');
  }
  return data.alimentos || [];
}

export async function detectarAlimentosFoto(imagenBase64, mediaType = 'image/jpeg') {
  return invokeLogMeal({ modo: 'foto', imagenBase64, mediaType });
}

export async function detectarAlimentosTexto(texto) {
  return invokeLogMeal({ modo: 'texto', texto });
}
