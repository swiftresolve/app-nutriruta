// push-notify: envía notificaciones push a las usuarias suscritas.
//
// Dos modos:
//  1) Programado (run: 'morning'|'evening'|'desayuno'|...): lo dispara el
//     cron (pg_cron + pg_net) en varias franjas del día, calcula el mensaje
//     por usuaria según su estado (racha, plan, agua, etc).
//  2) Directo (target_user_id + payload): lo dispara otra Edge Function
//     (hotmart-webhook) para avisar de un evento puntual de cuenta
//     (Premium activado, cancelación) al instante, sin esperar al cron.
//     Se envía siempre, sin filtrar por notifPrefs (son eventos de cuenta,
//     no recordatorios recurrentes).
//
// Protegida por un secreto compartido (x-cron-secret) en ambos modos.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

let vapidListo = false;
try {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails('mailto:support@nutriruta.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidListo = true;
  }
} catch (e) {
  console.error('VAPID inválido:', e instanceof Error ? e.message : e);
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function todayBogota(): string {
  const d = new Date(Date.now() - 5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function diasDesde(fechaInicio: string, fechaHoy: string): number {
  const [y1, m1, d1] = fechaInicio.split('-').map(Number);
  const [y2, m2, d2] = fechaHoy.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function metaAgua(state: Record<string, any>): number {
  const kg = state?.user?.pesoKg;
  if (!kg || kg < 30 || kg > 200) return 8;
  const vasos = Math.round((kg * 32.5) / 250);
  return Math.min(12, Math.max(6, vasos));
}

function vasosHoy(state: Record<string, any>): number {
  const agua = state?.agua;
  return agua?.fecha === todayBogota() ? (agua.vasos ?? 0) : 0;
}

function vasosEsperados(goal: number, horaLocal: number): number {
  const avance = Math.min(1, Math.max(0, (horaLocal - 6) / 14));
  return Math.ceil(goal * avance);
}

type Payload = { title: string; body: string; url: string };
type Prefs = { plan: boolean; comidas: boolean; agua: boolean };

function prefsDe(state: Record<string, any>): Prefs {
  const p = state?.notifPrefs ?? {};
  return { plan: p.plan !== false, comidas: p.comidas !== false, agua: p.agua !== false };
}

// "🌅" (amanecer) en desayuno reemplazado por "☀️" (sol) -- mismo cambio
// que ya se hizo en el ícono de la comida dentro de la app (MEALS en
// menu.js), para que la notificación y la app usen el mismo emoji.
const COMIDAS: Record<string, { hora: number; title: string; body: string }> = {
  desayuno:     { hora: 7,  title: '☀️ Hora del desayuno',  body: 'Tu menú de hoy ya tiene una opción lista para empezar bien el día.' },
  media_manana: { hora: 10, title: '🍎 Media mañana',       body: 'Un snack a tiempo evita el hambre feroz del almuerzo.' },
  almuerzo:     { hora: 12, title: '🍽️ Hora del almuerzo',  body: 'Tu plato de hoy te espera en la app.' },
  media_tarde:  { hora: 16, title: '☕ Media tarde',         body: 'El antojo de las 4pm no te gana hoy — tu alternativa te espera.' },
  cena:         { hora: 19, title: '🌙 Hora de la cena',     body: 'Cierra el día con una cena ligera — mira tu opción de hoy.' }
};

function buildMorningPayload(state: Record<string, any>): Payload | null {
  const hoy = todayBogota();
  const emergencia = state.emergencia;
  if (emergencia?.inicio) {
    const completados: number[] = emergencia.completados ?? [];
    if (completados.length < 7) {
      const diaDesbloqueado = Math.min(7, diasDesde(emergencia.inicio, hoy) + 1);
      if (diaDesbloqueado >= 1 && !completados.includes(diaDesbloqueado)) {
        return { title: '🏁 Tu Plan de 7 días', body: `El Día ${diaDesbloqueado} ya está disponible. Un paso más, a tu ritmo.`, url: './' };
      }
    }
  }
  if (state.onboarded && (state.diasCumplidos?.length ?? 0) >= 1) {
    const checkins = state.checkins ?? [];
    const last = checkins.length ? checkins[checkins.length - 1].fecha : null;
    const diasDesdeUltimo = last ? diasDesde(last, hoy) : 999;
    const diasDesdePospuesto = state.checkinPospuesto ? diasDesde(state.checkinPospuesto, hoy) : 999;
    if (diasDesdeUltimo >= 3 && diasDesdePospuesto >= 1) {
      return { title: '👋 ¿Cómo vas?', body: 'Tómate un minuto para contarnos cómo te ha ido — nos ayuda a acompañarte mejor.', url: './' };
    }
  }
  return null;
}

function buildEveningPayload(state: Record<string, any>): Payload | null {
  if (!state.onboarded) return null;
  const hoy = todayBogota();
  const habitos = state.habitos;
  const checks = habitos?.fecha === hoy ? (habitos.checks ?? {}) : {};
  const completados = Object.values(checks).filter(Boolean).length;
  if (completados >= 3) return null;
  const racha = state.racha ?? {};
  if ((racha.actual ?? 0) >= 2) {
    return { title: `🔥 Tu racha de ${racha.actual} días está en riesgo`, body: 'Aún no marcas tus hábitos de hoy. Un par de minutos y la mantienes.', url: './' };
  }
  return { title: '🌿 ¿Ya marcaste tus hábitos de hoy?', body: 'Un par de minutos suman a tu constancia.', url: './' };
}

function buildComidaPayload(run: string, state: Record<string, any>, prefs: Prefs): Payload | null {
  if (!state.onboarded) return null;
  const c = COMIDAS[run];
  if (!c) return null;

  const goal = metaAgua(state);
  const vasos = vasosHoy(state);
  const esperados = vasosEsperados(goal, c.hora);
  const atrasada = vasos < esperados - 1;

  if (prefs.comidas) {
    let body = c.body;
    if (prefs.agua && atrasada) body += ` 💧 Vas ${vasos}/${goal} vasos de agua — aprovecha para tomar uno.`;
    return { title: c.title, body, url: './' };
  }
  if (prefs.agua && atrasada) {
    return { title: '💧 Momento de un vaso de agua', body: `Vas ${vasos}/${goal} vasos hoy — uno ahora te mantiene al ritmo de tu meta.`, url: './' };
  }
  return null;
}

async function enviarATodos(
  admin: ReturnType<typeof createClient>,
  subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: Payload
): Promise<{ sent: number; errors: Array<{ endpoint: string; statusCode?: number; message: string }> }> {
  let sent = 0;
  const errors: Array<{ endpoint: string; statusCode?: number; message: string }> = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      errors.push({ endpoint: sub.endpoint.slice(-20), statusCode: err?.statusCode, message: err?.message ?? String(e) });
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        console.error('Error enviando push:', err?.message ?? e);
      }
    }
  }
  return { sent, errors };
}

Deno.serve(async (req) => {
  if (!CRON_SECRET) return json({ error: 'CRON_SECRET sin configurar (Edge Functions → Secrets)' }, 503);
  const recibido = req.headers.get('x-cron-secret') ?? '';
  if (!timingSafeEqual(recibido, CRON_SECRET)) {
    return new Response('unauthorized', { status: 401 });
  }
  if (!vapidListo) return json({ error: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY sin configurar (Edge Functions → Secrets)' }, 503);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* sin body */ }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // --- Modo directo: evento puntual de un usuario (Premium activado, etc.) ---
  const targetUserId = body.target_user_id as string | undefined;
  const directPayload = body.payload as Payload | undefined;
  if (targetUserId && directPayload?.title && directPayload?.body) {
    const { data: subs, error: subsError } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', targetUserId);
    if (subsError) return json({ error: subsError.message }, 500);
    if (!subs || !subs.length) return json({ sent: 0, total: 0, errors: [] });
    const { sent, errors } = await enviarATodos(admin, subs, { title: directPayload.title, body: directPayload.body, url: directPayload.url ?? './' });
    return json({ sent, total: subs.length, errors });
  }

  // --- Modo programado (cron) ---
  const run = String(body.run ?? 'morning');

  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth');
  if (subsError) return json({ error: subsError.message }, 500);
  if (!subs || !subs.length) return json({ sent: 0, run });

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: profiles, error: profError } = await admin
    .from('profiles')
    .select('id, state')
    .in('id', userIds);
  if (profError) return json({ error: profError.message }, 500);
  const stateByUser = new Map((profiles ?? []).map((p) => [p.id, p.state ?? {}]));

  let sent = 0;
  const errors: Array<{ endpoint: string; statusCode?: number; message: string }> = [];
  for (const sub of subs) {
    const state = stateByUser.get(sub.user_id);
    if (!state) continue;
    const prefs = prefsDe(state);

    let payload: Payload | null = null;
    if (run === 'morning') {
      payload = prefs.plan ? buildMorningPayload(state) : null;
    } else if (run === 'evening') {
      payload = prefs.plan ? buildEveningPayload(state) : null;
      if (!payload && prefs.agua && state.onboarded) {
        const goal = metaAgua(state);
        const vasos = vasosHoy(state);
        if (vasos < goal) {
          payload = { title: '💧 Un último empujón de agua', body: `Vas ${vasos}/${goal} vasos hoy — todavía alcanzas tu meta.`, url: './' };
        }
      }
    } else {
      payload = buildComidaPayload(run, state, prefs);
    }
    if (!payload) continue;

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      errors.push({ endpoint: sub.endpoint.slice(-20), statusCode: err?.statusCode, message: err?.message ?? String(e) });
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        console.error('Error enviando push:', err?.message ?? e);
      }
    }
  }
  return json({ sent, run, total: subs.length, errors });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
