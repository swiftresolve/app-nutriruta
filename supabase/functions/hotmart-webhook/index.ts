// Webhook de Hotmart → activa/desactiva el plan Premium en NutriRuta, y
// deja registro real de cada cobro/reverso en la tabla pagos (fuente de
// la sección "Ganancia real" y "Churn" del panel de administración).
//
// Configuración en Hotmart (Herramientas → Webhook / Postback v2):
//   URL:    https://rlcnxhykwfeasehmuhqe.supabase.co/functions/v1/hotmart-webhook
//   Eventos: compra aprobada/completa, reembolso, chargeback, cancelación de suscripción, compra expirada.
// Secretos requeridos en Supabase (Edge Functions → Secrets):
//   HOTMART_HOTTOK        → el "hottok" que muestra Hotmart al crear el webhook. (ya configurado)
//   HOTMART_OFERTA_ANUAL  → 'ti1e49b3' (código de oferta del plan anual, offer.code).
//   APP_URL (opcional)    → https://nutriruta.app (por defecto si no se define).
//   CRON_SECRET            → mismo secreto que usa push-notify (ya configurado), para poder
//                            avisarle a esa función que envíe una notificación puntual de evento.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ACTIVAR = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE']);

// Dinero de vuelta o compra que nunca se completó de verdad: no hay pago
// vigente detrás, así que el acceso se corta de inmediato.
const DESACTIVAR_INMEDIATO = new Set([
  'PURCHASE_REFUNDED',
  'PURCHASE_CHARGEBACK',
  'PURCHASE_CANCELED',
  'PURCHASE_EXPIRED'
]);

// Solo estos dos representan dinero que de verdad se devolvió (afectan la
// ganancia real). Cancelado/expirado significa que la compra nunca se
// completó de verdad -- no hay un cobro previo que reversar.
const REVERSOS_REALES = new Set(['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK']);

// Cancelar la suscripción NO es un reembolso: solo detiene el próximo cobro.
// Lo ya pagado se queda pagado y el acceso debe seguir hasta que termine el
// período vigente (plan_desde + duración) — la app ya calcula eso sola con
// isPremiumVigente(), así que aquí no tocamos plan/plan_desde. Si se lo
// quitáramos ya, le estaríamos negando a la clienta algo que sí pagó.
const CANCELACION_SIN_REVOCAR = new Set(['SUBSCRIPTION_CANCELLATION']);

// Precios reales de los dos planes (ver js/config.js / Planes en la app).
const PLAN_PRICES: Record<string, number> = { mensual: 9, anual: 90 };

// Misma vigencia por periodo que usa el resto de la app (store.js, ai-assistant).
const PLAN_DAYS: Record<string, number> = { mensual: 33, anual: 368 };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const hottok = Deno.env.get('HOTMART_HOTTOK');
  if (!hottok) return json({ error: 'HOTMART_HOTTOK sin configurar' }, 503);

  const recibido = req.headers.get('x-hotmart-hottok') ?? '';
  if (!timingSafeEqual(recibido, hottok)) return json({ error: 'No autorizado' }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const event = String(payload.event ?? '');
  const data = (payload.data ?? {}) as Record<string, any>;
  const email: string = data?.buyer?.email ?? data?.subscriber?.email ?? '';
  if (!email) return json({ error: 'Payload sin email de comprador' }, 400);
  const nombre: string = data?.buyer?.name ?? '';
  // Hotmart puede reenviar el mismo webhook (timeout, reintento propio de
  // ellos) -- sin poder identificar "ya procesé esto", un reenvío de
  // PURCHASE_APPROVED resetearía plan_desde a "ahora" otra vez, regalando
  // días extra de Premium sin ningún cobro nuevo detrás.
  const transactionId: string | null = data?.purchase?.transaction ?? null;

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  if (transactionId) {
    const { data: yaProcesado } = await admin
      .from('pagos')
      .select('id')
      .eq('hotmart_transaction', transactionId)
      .eq('evento', event)
      .maybeSingle();
    if (yaProcesado) {
      console.log(`Evento ${event} de la transacción ${transactionId} ya se había procesado -- se ignora el reenvío.`);
      return json({ ok: true, ignorado: 'duplicado', evento: event });
    }
  }

  const { data: userId, error: lookupError } = await admin.rpc('user_id_por_email', { p_email: email });
  if (lookupError) return json({ error: 'Error buscando usuario' }, 500);

  if (!userId) {
    if (ACTIVAR.has(event)) {
      const periodo = inferirPeriodo(data);
      const appUrl = Deno.env.get('APP_URL') ?? 'https://nutriruta.app';
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/?invite=1`,
        data: { nombre }
      });
      if (inviteError || !invited?.user) {
        console.error('No se pudo invitar a la usuaria:', inviteError);
        const { error: logError } = await admin.from('compras_sin_vincular').insert({
          email_hotmart: email, evento: event, periodo
        });
        if (logError) console.error('No se pudo registrar compra sin vincular:', logError);
        return json({ ok: true, aviso: 'No se pudo crear la cuenta automáticamente; registrada para revisión manual.' });
      }
      const { error: activateError } = await admin
        .from('profiles')
        .update({ plan: 'premium', plan_periodo: periodo, plan_desde: new Date().toISOString() })
        .eq('id', invited.user.id);
      if (activateError) {
        console.error('Cuenta invitada pero no se pudo activar el plan:', activateError);
        return json({ error: 'Cuenta creada pero no se pudo activar el plan' }, 500);
      }
      await registrarPago(admin, invited.user.id, email, event, periodo, PLAN_PRICES[periodo] ?? 0, transactionId);
      console.log(`Cuenta creada por invitación y Premium ${periodo} activado para ${email} (${event}).`);
      return json({ ok: true, plan: 'premium', periodo, invitada: true });
    }

    console.warn(`Evento ${event} de ${email} sin cuenta y no es de activación; se ignora.`);
    return json({ ok: true, ignorado: event });
  }

  if (ACTIVAR.has(event)) {
    const periodo = inferirPeriodo(data);
    const { error } = await admin
      .from('profiles')
      .update({ plan: 'premium', plan_periodo: periodo, plan_desde: new Date().toISOString() })
      .eq('id', userId);
    if (error) return json({ error: 'No se pudo activar el plan' }, 500);
    await registrarPago(admin, userId, email, event, periodo, PLAN_PRICES[periodo] ?? 0, transactionId);
    console.log(`Premium ${periodo} activado para ${email} (${event}).`);
    if (periodo === 'anual') await registrarReferidoSiAplica(admin, userId, periodo, transactionId);
    await enviarPush(userId, {
      title: '✨ ¡Ya eres Premium!',
      body: 'SuSana y la Misión de 12 semanas ya están disponibles para ti.',
      url: './'
    });
    return json({ ok: true, plan: 'premium', periodo });
  }

  if (DESACTIVAR_INMEDIATO.has(event)) {
    // Si esta compra tenía un referido pendiente (30 días para el
    // referente y la referida en cuanto pasen 7 días, ver referral-check),
    // se cancela de inmediato -- nunca se otorga sobre una compra que se
    // canceló/reembolsó/expiró. El cron vuelve a verificar esto de todas
    // formas antes de otorgar (por si el orden de los webhooks se cruza),
    // pero cancelar aquí también evita el trabajo de esperar 7 días para
    // algo que ya se sabe que no aplica.
    await admin.from('referidos').update({ estado: 'cancelado', resuelto_en: new Date().toISOString() })
      .eq('referido_id', userId).eq('estado', 'pendiente');

    const { data: perfilPrevio } = await admin
      .from('profiles')
      .select('plan_periodo')
      .eq('id', userId)
      .maybeSingle();
    const periodoPrevio = perfilPrevio?.plan_periodo ?? inferirPeriodo(data);

    const { error } = await admin
      .from('profiles')
      .update({ plan: 'free', plan_periodo: null, plan_desde: null })
      .eq('id', userId);
    if (error) return json({ error: 'No se pudo desactivar el plan' }, 500);

    if (REVERSOS_REALES.has(event)) {
      await registrarPago(admin, userId, email, event, periodoPrevio, -(PLAN_PRICES[periodoPrevio] ?? 0), transactionId);
    } else {
      await registrarPago(admin, userId, email, event, periodoPrevio, 0, transactionId);
    }
    console.log(`Plan desactivado de inmediato para ${email} (${event}).`);
    return json({ ok: true, plan: 'free' });
  }

  if (CANCELACION_SIN_REVOCAR.has(event)) {
    const { data: profile } = await admin
      .from('profiles')
      .select('plan_desde, plan_periodo')
      .eq('id', userId)
      .maybeSingle();
    let fechaTexto = 'el final de tu período actual';
    const dias = profile?.plan_periodo ? PLAN_DAYS[profile.plan_periodo] : undefined;
    if (profile?.plan_desde && dias) {
      const vence = new Date(new Date(profile.plan_desde).getTime() + dias * 86400000);
      fechaTexto = vence.toLocaleDateString('es', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' });
    }
    // Registrada con monto 0 (no es un reverso de dinero, ver REVERSOS_REALES)
    // -- solo para que el panel de admin pueda contar el churn voluntario del
    // mes, que antes no dejaba ningún rastro en pagos.
    await registrarPago(admin, userId, email, event, profile?.plan_periodo ?? inferirPeriodo(data), 0, transactionId);
    console.log(`Suscripción cancelada (sin revocar acceso vigente) para ${email} (${event}).`);
    await enviarPush(userId, {
      title: 'Tu suscripción no se renovará',
      body: `Tu Premium sigue activo hasta el ${fechaTexto}. Puedes reactivarla cuando quieras.`,
      url: './'
    });
    return json({ ok: true, aviso: 'Cancelación registrada; el acceso sigue hasta el final del período ya pagado.' });
  }

  console.log(`Evento ignorado: ${event} (${email}).`);
  return json({ ok: true, ignorado: event });
});

// Sistema de referidos (ver migración add_referidos): si esta usuaria
// llegó con un código de referido guardado (user.referidoPor, capturado de
// "?ref=" en app.js y migrado a la nube al crear la cuenta) y el plan es
// anual, se registra un referido "pendiente" -- el cron referral-check
// (7 días después) verifica que siga vigente y recién ahí otorga los 30
// días a ambas cuentas. Nunca se otorga nada aquí mismo: eso evita
// regalar Premium por una compra que se cancela/reembolsa en la primera
// semana.
async function registrarReferidoSiAplica(
  admin: ReturnType<typeof createClient>,
  referidoId: string,
  periodo: string,
  transactionId: string | null
) {
  try {
    const { data: perfil } = await admin.from('profiles').select('state').eq('id', referidoId).maybeSingle();
    const codigo = String(perfil?.state?.user?.referidoPor ?? '').trim().toUpperCase();
    if (!codigo) return;

    const { data: referente } = await admin.from('profiles').select('id').eq('referido_codigo', codigo).maybeSingle();
    if (!referente || referente.id === referidoId) return; // código inválido o auto-referido

    // unique(referido_id) en la tabla ya lo impide a nivel de base de datos,
    // pero se verifica antes para no depender solo del error de conflicto.
    const { data: existente } = await admin.from('referidos').select('id').eq('referido_id', referidoId).maybeSingle();
    if (existente) return;

    const { error } = await admin.from('referidos').insert({
      referente_id: referente.id,
      referido_id: referidoId,
      codigo,
      periodo,
      fecha_compra: new Date().toISOString(),
      hotmart_transaction: transactionId
    });
    if (error) console.error('No se pudo registrar el referido:', error.message);
    else console.log(`Referido pendiente registrado: ${referente.id} -> ${referidoId} (código ${codigo}).`);
  } catch (e) {
    console.error('Error registrando referido:', e instanceof Error ? e.message : e);
  }
}

async function registrarPago(
  admin: ReturnType<typeof createClient>,
  userId: string,
  email: string,
  evento: string,
  periodo: string | null,
  monto: number,
  transactionId: string | null = null
) {
  try {
    const { error } = await admin.from('pagos').insert({
      user_id: userId, email, evento, periodo, monto, hotmart_transaction: transactionId
    });
    if (error) console.error('No se pudo registrar el pago:', error.message);
  } catch (e) {
    console.error('No se pudo registrar el pago:', e instanceof Error ? e.message : e);
  }
}

async function enviarPush(userId: string, payload: { title: string; body: string; url?: string }) {
  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret) return;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    await fetch(`${supabaseUrl}/functions/v1/push-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
      body: JSON.stringify({ target_user_id: userId, payload })
    });
  } catch (e) {
    console.error('No se pudo enviar push de evento:', e instanceof Error ? e.message : e);
  }
}

function inferirPeriodo(data: Record<string, any>): 'mensual' | 'anual' {
  const ofertaAnual = Deno.env.get('HOTMART_OFERTA_ANUAL');
  const oferta = data?.purchase?.offer?.code ?? '';
  if (ofertaAnual && oferta === ofertaAnual) return 'anual';
  const recurrencia = String(
    data?.subscription?.plan?.recurrency_period ?? data?.purchase?.recurrence_number ?? ''
  ).toUpperCase();
  if (recurrencia.includes('YEAR') || recurrencia.includes('ANUAL') || recurrencia === '365') return 'anual';
  return 'mensual';
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
