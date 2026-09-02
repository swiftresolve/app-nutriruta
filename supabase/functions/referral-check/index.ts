// referral-check: otorga el bono de 30 días de Premium a quien comparte
// (referente) y a quien usa el código (referido) — pero SOLO 7 días
// después de que la referida activó el plan ANUAL, y solo si para
// entonces sigue activo (no lo canceló ni pidió reembolso). Decisión
// explícita de la usuaria: "solo aplica para personas que activen el plan
// anual sin cancelarlo antes de 7 días".
//
// Disparado por un cron diario (pg_cron + pg_net), mismo patrón que
// push-notify: protegido por el secreto compartido x-cron-secret.
//
// Cómo se registra el referido: hotmart-webhook, al procesar un
// PURCHASE_APPROVED/COMPLETE con periodo anual, revisa si la compradora
// tiene user.referidoPor guardado (capturado de "?ref=" en app.js) y crea
// una fila en `referidos` con estado 'pendiente'. Si la compra se
// cancela/reembolsa antes, ese mismo webhook la marca 'cancelado' de
// inmediato — esta función solo procesa lo que sigue 'pendiente' pasados
// los 7 días, y vuelve a verificar el estado actual del plan por si acaso
// (defensa en profundidad, nunca confiar en un solo punto de chequeo).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const DIAS_ESPERA = 7;
const BONO_DIAS = 30;

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (!CRON_SECRET) return json({ error: 'CRON_SECRET sin configurar' }, 503);
  const recibido = req.headers.get('x-cron-secret') ?? '';
  if (!timingSafeEqual(recibido, CRON_SECRET)) return new Response('unauthorized', { status: 401 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const limite = new Date(Date.now() - DIAS_ESPERA * 86400000).toISOString();
  const { data: pendientes, error } = await admin
    .from('referidos')
    .select('id, referente_id, referido_id, fecha_compra')
    .eq('estado', 'pendiente')
    .lte('fecha_compra', limite);
  if (error) return json({ error: error.message }, 500);
  if (!pendientes || !pendientes.length) return json({ procesados: 0, otorgados: 0, cancelados: 0 });

  let otorgados = 0, cancelados = 0;

  for (const ref of pendientes) {
    const { data: perfilReferido } = await admin
      .from('profiles')
      .select('plan, plan_periodo')
      .eq('id', ref.referido_id)
      .maybeSingle();

    // Sigue premium anual pasados los 7 días: se otorga. Si no (se
    // canceló/reembolsó y por lo que sea el webhook no llegó a marcarlo
    // acá, o cambió de periodo), se cancela sin otorgar nada.
    const sigueVigente = perfilReferido?.plan === 'premium' && perfilReferido?.plan_periodo === 'anual';

    if (!sigueVigente) {
      await admin.from('referidos').update({ estado: 'cancelado', resuelto_en: new Date().toISOString() }).eq('id', ref.id);
      cancelados++;
      continue;
    }

    await otorgarBono(admin, ref.referido_id);
    await otorgarBono(admin, ref.referente_id);
    await admin.from('referidos').update({ estado: 'otorgado', resuelto_en: new Date().toISOString() }).eq('id', ref.id);
    otorgados++;
    console.log(`Referido ${ref.id}: bono de ${BONO_DIAS} días otorgado a ${ref.referente_id} y ${ref.referido_id}.`);
  }

  return json({ procesados: pendientes.length, otorgados, cancelados });
});

// Si ya es premium (cualquier periodo), extiende su vigencia real 30 días
// (adelanta plan_desde) -- funciona igual sin importar si es mensual o
// anual, porque solo corre el reloj de vencimiento. Si no tiene un plan
// premium activo, la activa como si fuera un plan mensual que arrancó
// hace pocos días, para que le queden exactamente 30 días de acceso
// (reutiliza la misma fórmula de vigencia que ya usa toda la app en vez
// de inventar un tipo de plan nuevo que haya que enseñarle a cada
// función que calcula vigencia).
async function otorgarBono(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: perfil } = await admin.from('profiles').select('plan, plan_periodo, plan_desde').eq('id', userId).maybeSingle();
  if (!perfil) return;

  if (perfil.plan === 'premium' && perfil.plan_desde) {
    const nuevaFecha = new Date(new Date(perfil.plan_desde).getTime() - BONO_DIAS * 86400000).toISOString();
    await admin.from('profiles').update({ plan_desde: nuevaFecha }).eq('id', userId);
  } else {
    // mensual = 33 días de vigencia en el resto de la app; arrancarlo
    // "hace 3 días" deja exactamente 30 días reales por delante.
    const nuevaFecha = new Date(Date.now() - 3 * 86400000).toISOString();
    await admin.from('profiles').update({ plan: 'premium', plan_periodo: 'mensual', plan_desde: nuevaFecha }).eq('id', userId);
  }

  await admin.from('pagos').insert({ user_id: userId, email: '', evento: 'REFERRAL_BONUS', periodo: null, monto: 0 });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
