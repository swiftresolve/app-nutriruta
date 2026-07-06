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

export async function signOut() {
  return supabase.auth.signOut();
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

export async function updatePlan(plan, periodo) {
  // El plan ya no se escribe directo en la tabla (columnas protegidas):
  // se pasa por funciones del servidor. La activación real la hace el
  // webhook de Hotmart; esta vía queda para la cortesía de lanzamiento.
  if (plan === 'premium') {
    const { error } = await supabase.rpc('cortesia_activar_premium', { p_periodo: periodo });
    if (error) throw error;
  } else {
    const { error } = await supabase.rpc('bajar_a_gratuito');
    if (error) throw error;
  }
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
