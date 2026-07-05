// Planes de suscripción: mensual y anual (pago vía Hotmart).
import { getPlan, setPlanCache } from '../store.js';
import { updatePlan } from '../supabase-client.js';
import { HOTMART_CHECKOUT } from '../config.js';
import { header, navigate, toast, openModal } from '../app.js';

const PLANS = [
  {
    id: 'mensual', nombre: 'Premium Mensual', precio: 'USD 9', periodo: '/ mes', emoji: '🌱',
    detalle: 'Menos de lo que cuestan 2 comidas fuera de casa.'
  },
  {
    id: 'anual', nombre: 'Premium Anual', precio: 'USD 90', periodo: '/ año', emoji: '🌳',
    detalle: 'Equivale a USD 7.50/mes — 2 meses gratis.', destacado: true
  }
];

const PREMIUM_FEATURES = [
  '🎯 Misión 12 semanas completa',
  '🥗 Recetario completo y menús ilimitados',
  '🛒 Listas de compras automáticas',
  '💚 SOS antojos con detección de patrones',
  '📚 Todas las micro-lecciones',
  '☁️ Respaldo en la nube en todos tus dispositivos'
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
    ${plan.tipo === 'premium'
      ? `<p class="mt"><span class="tag verde">Plan actual: Premium ${plan.periodo}</span></p>`
      : '<p class="mt"><span class="tag info">Plan actual: Gratuito</span></p>'}`;
  container.appendChild(hero);

  // Plan gratuito
  const free = document.createElement('div');
  free.className = 'card';
  free.innerHTML = `
    <div class="spread"><h3>🍃 Plan Gratuito</h3><strong>USD 0</strong></div>
    <p class="small mt">Quiz personalizado, menú diario, seguimiento de agua y hábitos, y Semana 1 de la Misión.</p>`;
  if (plan.tipo === 'premium') {
    const back = document.createElement('button');
    back.className = 'btn ghost sm mt';
    back.textContent = 'Volver al plan gratuito';
    back.addEventListener('click', () => choose(null, container));
    free.appendChild(back);
  }
  container.appendChild(free);

  // Planes premium
  for (const p of PLANS) {
    const card = document.createElement('div');
    card.className = 'card';
    if (p.destacado) card.style.border = '2px solid var(--primary)';
    const isCurrent = plan.tipo === 'premium' && plan.periodo === p.id;
    card.innerHTML = `
      ${p.destacado ? '<span class="tag verde">Recomendado · ahorra 17 %</span>' : ''}
      <div class="spread mt"><h3>${p.emoji} ${p.nombre}</h3><strong>${p.precio} <span class="muted small">${p.periodo}</span></strong></div>
      <p class="small">${p.detalle}</p>
      <ul class="steps small mt">${PREMIUM_FEATURES.map((f) => `<li>${f}</li>`).join('')}</ul>`;
    const btn = document.createElement('button');
    btn.className = isCurrent ? 'btn ghost full mt' : 'btn accent full mt';
    btn.textContent = isCurrent ? '✓ Tu plan actual' : `Elegir ${p.nombre}`;
    btn.disabled = isCurrent;
    btn.addEventListener('click', () => confirmPlan(p, container));
    card.appendChild(btn);
    container.appendChild(card);
  }

  const note = document.createElement('div');
  note.className = 'legal-note';
  note.innerHTML = hotmartReady()
    ? 'ℹ️ El pago se procesa de forma segura a través de <strong>Hotmart</strong>. Tras completar tu compra, tu plan Premium se activará en tu cuenta. Puedes cancelar en cualquier momento desde Hotmart.'
    : 'ℹ️ <strong>Versión de lanzamiento:</strong> la pasarela de pagos (Hotmart) aún no está conectada; al elegir un plan se activa Premium en tu cuenta sin costo, como cortesía de prueba. Podrás cancelar o cambiar de plan en cualquier momento.';
  container.appendChild(note);
}

function hotmartReady() {
  return !!(HOTMART_CHECKOUT.mensual && HOTMART_CHECKOUT.anual);
}

function confirmPlan(p, container) {
  // Con Hotmart configurado, el checkout se abre en la plataforma de pago.
  if (hotmartReady()) {
    window.open(HOTMART_CHECKOUT[p.id], '_blank', 'noopener');
    toast('Completa tu compra en Hotmart; tu plan se activará al confirmarse el pago.');
    return;
  }
  openModal((modal, close) => {
    modal.insertAdjacentHTML('beforeend', `
      <h2>${p.emoji} ${p.nombre}</h2>
      <p class="mt">Activarás el plan <strong>${p.nombre}</strong> (${p.precio} ${p.periodo}).</p>
      <p class="small muted mt">Sin pasarela de pagos conectada: se activa como cortesía de lanzamiento.</p>`);
    const yes = document.createElement('button');
    yes.className = 'btn full mt';
    yes.textContent = 'Confirmar';
    yes.addEventListener('click', async () => {
      close();
      await choose(p.id, container);
    });
    modal.appendChild(yes);
  });
}

async function choose(periodo, container) {
  try {
    if (periodo) {
      await updatePlan('premium', periodo);
      setPlanCache('premium', periodo);
      toast('✨ ¡Premium activado! Tu Misión 12 semanas te espera.');
      navigate('mission');
    } else {
      await updatePlan('free', null);
      setPlanCache('free', null);
      toast('Plan gratuito activado.');
      container.innerHTML = '';
      renderPlans(container);
    }
  } catch (e) {
    toast('No se pudo actualizar el plan. Revisa tu conexión.');
  }
}
