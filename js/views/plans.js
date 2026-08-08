// Planes de suscripción: mensual y anual (pago vía Hotmart).
import { getPlan, setPlanCache, isPremium, planExpired, planExpiry } from '../store.js';
import { downgradeToFree } from '../supabase-client.js';
import { HOTMART_CHECKOUT } from '../config.js';
import { header, navigate, toast } from '../app.js';

const PLANS = [
  {
    id: 'anual', nombre: 'Premium Anual', emoji: '🌳',
    precioMes: 'USD 7.50', cobro: 'Se cobra USD 90 una vez al año.',
    detalle: 'Equivale a 2 meses gratis frente al plan mensual.', destacado: true
  },
  {
    id: 'mensual', nombre: 'Premium Mensual', emoji: '🌱',
    precioMes: 'USD 9', cobro: 'Sin compromiso — cancela cuando quieras.',
    detalle: 'Menos de lo que cuestan 2 comidas fuera de casa.'
  }
];

const FREE_FEATURES = [
  '📋 Quiz y perfiles de salud personalizados',
  '🍽️ Menú diario adaptado a ti',
  '💧 Seguimiento de agua, hábitos y tu Ruta',
  '💚 Botón SOS antojo con respiración guiada',
  '📚 2 micro-lecciones',
  '🎯 Semana 1 de la Misión (prueba)'
];

const PREMIUM_FEATURES = [
  '🎯 Misión 12 semanas completa',
  '🥗 Recetario completo (el plan gratis ve una selección)',
  '🛒 Lista de compras automática',
  '💡 Detección de patrones de antojos',
  '📚 Todas las micro-lecciones',
  'Todo lo del plan gratuito, sin límites'
];

export function renderPlans(container) {
  header(container);
  const plan = getPlan();

  const hero = document.createElement('div');
  hero.className = 'card center';
  hero.innerHTML = `
    <div style="font-size:2.6rem">✨</div>
    <h2>Planes NutriRuta</h2>
    <p class="small">Invierte en tu salud lo que cuestan un par de comidas fuera.</p>
    ${planBadge(plan)}`;
  container.appendChild(hero);

  // Plan gratuito
  const free = document.createElement('div');
  free.className = 'card';
  free.innerHTML = `
    <div class="spread"><h3>🍃 Plan Gratuito</h3><strong>USD 0</strong></div>
    <ul class="steps small mt">${FREE_FEATURES.map((f) => `<li>${f}</li>`).join('')}</ul>`;
  if (plan.tipo === 'premium') {
    const back = document.createElement('button');
    back.className = 'btn ghost sm mt';
    back.textContent = 'Volver al plan gratuito';
    back.addEventListener('click', () => choose(container));
    free.appendChild(back);
  }
  container.appendChild(free);

  // Planes premium: una sola tarjeta con las dos opciones seleccionables
  // (como filas de radio-button), no dos tarjetas sueltas — tocar una
  // resalta esa opción; un solo botón abajo confirma la elegida.
  const premCard = document.createElement('div');
  premCard.className = 'card';
  let elegido = PLANS.find((p) => p.destacado) || PLANS[0];
  premCard.innerHTML = `
    <h3>✨ Premium</h3>
    <div class="plan-options mt" id="plan-options"></div>
    <p class="small mt" style="font-weight:700">Todo lo que desbloqueas:</p>
    <ul class="steps check small mt">${PREMIUM_FEATURES.map((f) => `<li>${f}</li>`).join('')}</ul>
    <button class="btn accent full mt" id="plan-elegir"></button>
    <div class="plan-guarantees mt">
      <div class="pg-item">✅ Cancelas cuando quieras desde Hotmart</div>
      <div class="pg-item">✅ Tu Premium se activa automático al confirmarse el pago</div>
      <div class="pg-item">✅ Pago procesado de forma segura por Hotmart</div>
      <div class="pg-item">✅ 7 días de garantía de reembolso desde tu compra</div>
    </div>`;
  const optsEl = premCard.querySelector('#plan-options');
  const btnEl = premCard.querySelector('#plan-elegir');

  function pintarOpciones() {
    optsEl.innerHTML = '';
    for (const p of PLANS) {
      const isCurrent = isPremium() && plan.periodo === p.id;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'plan-option' + (elegido.id === p.id ? ' selected' : '');
      row.innerHTML = `
        <span class="plan-radio"></span>
        <span class="plan-option-body">
          <span class="spread">
            <strong>${p.emoji} ${p.nombre}</strong>
            ${p.destacado ? '<span class="tag verde">Ahorra 17%</span>' : ''}
          </span>
          <span class="price-anchor mt"><span class="price-big">${p.precioMes}</span><span class="muted small">&nbsp;/ mes</span></span>
          <span class="small muted" style="display:block">${p.cobro}</span>
          ${isCurrent ? '<span class="tag info mt" style="display:inline-block">Tu plan actual</span>' : ''}
        </span>`;
      row.addEventListener('click', () => { elegido = p; pintarOpciones(); });
      optsEl.appendChild(row);
    }
    const isCurrentElegido = isPremium() && plan.periodo === elegido.id;
    btnEl.textContent = isCurrentElegido ? '✓ Tu plan actual' : `Elegir ${elegido.nombre}`;
    btnEl.disabled = isCurrentElegido;
    btnEl.className = isCurrentElegido ? 'btn ghost full mt' : 'btn accent full mt';
  }
  pintarOpciones();
  btnEl.addEventListener('click', () => confirmPlan(elegido));
  container.appendChild(premCard);

  const note = document.createElement('div');
  note.className = 'legal-note';
  note.innerHTML = 'ℹ️ El pago se procesa de forma segura a través de <strong>Hotmart</strong>. Tras completar tu compra, tu plan Premium se activará en tu cuenta.';
  container.appendChild(note);
}

function planBadge(plan) {
  if (planExpired()) {
    return '<p class="mt"><span class="tag rojo">Tu plan Premium venció</span></p><p class="small">Renueva para recuperar tus funciones Premium. Tu progreso está guardado.</p>';
  }
  if (isPremium()) {
    const vence = planExpiry();
    const fecha = vence ? vence.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    return `<p class="mt"><span class="tag verde">Plan actual: Premium ${plan.periodo}</span></p><p class="small">Activo hasta el ${fecha}.</p>`;
  }
  return '<p class="mt"><span class="tag info">Plan actual: Gratuito</span></p>';
}

function confirmPlan(p) {
  window.open(HOTMART_CHECKOUT[p.id], '_blank', 'noopener');
  toast('Completa tu compra en Hotmart; tu plan se activará al confirmarse el pago.');
}

async function choose(container) {
  try {
    await downgradeToFree();
    setPlanCache('free', null, null);
    toast('Plan gratuito activado.');
    container.innerHTML = '';
    renderPlans(container);
  } catch (e) {
    toast('No se pudo actualizar el plan. Revisa tu conexión.');
  }
}
