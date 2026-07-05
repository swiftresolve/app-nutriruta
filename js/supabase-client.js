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
  const { error } = await supabase.from('profiles').upsert({
    id: session.user.id,
    nombre: (nombre || '').slice(0, 60),
    state
  });
  if (error) throw error;
}

export async function updatePlan(plan, periodo) {
  const session = await getSession();
  if (!session) throw new Error('Sin sesión');
  const { error } = await supabase.from('profiles').update({
    plan,
    plan_periodo: periodo,
    plan_desde: plan === 'premium' ? new Date().toISOString() : null
  }).eq('id', session.user.id);
  if (error) throw error;
}
