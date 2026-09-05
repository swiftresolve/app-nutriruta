// Panel de administración: solo para correos en admin_emails, verificado
// en el servidor (admin_dashboard, ver migración). Esta vista no decide
// nada de acceso — solo pide los datos y muestra "No autorizado" si el
// servidor los niega.
import { fetchAdminDashboard, adminSetPlan } from '../supabase-client.js';
import { header, toast } from '../app.js';
import { esc } from '../store.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function money(n) {
  return `$${Number(n ?? 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function renderAdmin(container) {
  cargarYPintar(container);
}

function cargarYPintar(container) {
  header(container);

  const loading = document.createElement('div');
  loading.className = 'card center';
  loading.innerHTML = '<p class="small muted">Cargando panel…</p>';
  container.appendChild(loading);

  fetchAdminDashboard().then((d) => {
    loading.remove();
    pintarPanel(container, d);
  }).catch((e) => {
    loading.remove();
    const denegado = document.createElement('div');
    denegado.className = 'card center';
    denegado.innerHTML = `
      <div style="font-size:2.2rem">🔒</div>
      <h2>No autorizado</h2>
      <p class="small mt">Esta pantalla es solo para administradoras de NutriRuta.</p>`;
    container.appendChild(denegado);
    if (e?.message && e.message !== 'No autorizado') console.error('Error cargando el panel de admin:', e.message);
  });
}

// Tras activar/quitar Premium a mano, se vuelve a pedir todo el panel
// (no solo la fila tocada) -- así ganancia, avisos y el resto de conteos
// quedan consistentes con el cambio, no solo la tabla.
function recargar(container) {
  container.innerHTML = '';
  cargarYPintar(container);
}

function pintarPanel(container, d) {
  const fecha = new Date(d.mes_desde + 'T00:00:00');
  const mesTexto = `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;

  // --- Avisos automáticos ---
  const avisos = document.createElement('div');
  avisos.className = 'card';
  if (d.avisos.length) {
    avisos.style.borderLeft = '4px solid var(--red)';
    avisos.innerHTML = `<h2>🔔 Avisos</h2>` + d.avisos.map((a) => `<p class="small mt">⚠️ ${a.texto}</p>`).join('');
  } else {
    avisos.style.borderLeft = '4px solid var(--green)';
    avisos.innerHTML = `<h2>🔔 Avisos</h2><p class="small mt">✅ Todo en orden este mes.</p>`;
  }
  container.appendChild(avisos);

  // --- Ganancia real ---
  const g = d.ganancia_real;
  const ganancia = document.createElement('div');
  ganancia.className = 'card';
  ganancia.style.background = 'linear-gradient(135deg, var(--primary-soft), var(--secondary-soft))';
  ganancia.style.border = 'none';
  ganancia.innerHTML = `
    <div class="spread"><h2>💰 Ganancia real — ${mesTexto}</h2></div>
    <div class="num" style="font-size:2.2rem;font-weight:800;color:var(--primary-dark);margin-top:6px">${money(g.neto)}</div>
    <p class="small muted">Facturaste ${money(g.ingresos)}${g.reversos > 0 ? ` (−${money(g.reversos)} en reversos)` : ''} − ${money(g.costo_ia_estimado)} de IA estimada.</p>
    ${g.margen_pct !== null ? `<p class="small mt"><strong>Margen: ${g.margen_pct}%</strong></p>` : '<p class="small mt muted">Sin ingresos este mes todavía — no hay margen que calcular.</p>'}`;
  container.appendChild(ganancia);

  // --- Ventas ---
  const v = d.ventas;
  const ventas = document.createElement('div');
  ventas.className = 'card';
  ventas.innerHTML = `
    <h2>🛒 Ventas</h2>
    <div class="chips mt">
      <span class="tag verde">${v.premium_activas} Premium activas</span>
      <span class="tag info">${v.premium_mensual} mensual</span>
      <span class="tag info">${v.premium_anual} anual</span>
    </div>`;
  if (v.eventos_mes.length) {
    ventas.insertAdjacentHTML('beforeend', '<p class="small mt" style="font-weight:600">Eventos de este mes:</p>');
    for (const ev of v.eventos_mes.slice(0, 10)) {
      const fechaEv = new Date(ev.fecha).toLocaleDateString('es', { day: 'numeric', month: 'short' });
      const signo = ev.monto > 0 ? '+' : ev.monto < 0 ? '−' : '';
      ventas.insertAdjacentHTML('beforeend', `<div class="habit"><label>${fechaEv} · ${ev.evento}${ev.periodo ? ` (${ev.periodo})` : ''}</label><span class="small">${signo}${money(Math.abs(ev.monto))}</span></div>`);
    }
  } else {
    ventas.insertAdjacentHTML('beforeend', '<p class="small muted mt">Sin eventos de pago registrados este mes.</p>');
  }
  container.appendChild(ventas);

  // --- Usuarias ---
  const u = d.usuarias;
  const usuarias = document.createElement('div');
  usuarias.className = 'card';
  usuarias.innerHTML = `
    <h2>👥 Usuarios</h2>
    <div class="chips mt">
      <span class="tag info">${u.total} total</span>
      <span class="tag verde">${u.premium} Premium</span>
      <span class="tag">${u.gratis} gratis</span>
      <span class="tag">${u.nuevas_mes} nuevas este mes</span>
    </div>`;
  if (u.detalle?.length) {
    const fecha = (iso) => iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    // "Último acceso" sí necesita hora, no solo fecha -- a diferencia de
    // "creada"/"vence" (donde el día ya dice todo lo que hace falta), acá
    // la usuaria pidió el timestamp completo.
    const fechaHora = (iso) => iso ? new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
    // Tarjeta por usuaria en vez de una tabla ancha: en el celular una
    // tabla de 7 columnas con scroll horizontal deja la columna de
    // "Acción" (el selector para activar/quitar Premium) fuera de la
    // pantalla sin ningún indicio de que hay que deslizar para verla --
    // reportado como "no lo puedo hacer desde el panel" cuando la función
    // sí existía, solo estaba inalcanzable en la práctica en móvil.
    const listaEl = document.createElement('div');
    listaEl.className = 'mt';
    listaEl.innerHTML = '<p class="small" style="font-weight:600">Detalle:</p>';
    for (const r of u.detalle) {
      const row = document.createElement('div');
      row.className = 'habit';
      row.style.cssText = 'flex-direction:column;align-items:stretch;gap:6px';
      row.dataset.uid = r.user_id;
      row.innerHTML = `
        <div class="spread">
          <strong style="font-size:0.9rem">${esc(r.email)}${r.nombre ? ` <span class="muted small">(${esc(r.nombre)})</span>` : ''}</strong>
          <span class="small">${r.plan === 'premium' ? `✨ ${esc(r.plan_periodo || '')}` : 'gratis'}</span>
        </div>
        <p class="small muted">
          ${r.plan === 'premium' ? (r.tiene_pago_real ? '💳 pago real' : '<span style="color:var(--red)">⚠️ sin pago</span>') : 'sin plan pago'}
          ${r.vence ? ` · vence ${fecha(r.vence)}` : ''} · creada ${fecha(r.creada)} · último acceso ${fechaHora(r.ultimo_acceso)}
        </p>
        <select class="admin-plan-sel auth-input" style="margin:0;font-size:0.85rem">
          <option value="">Cambiar plan…</option>
          <option value="premium:mensual">Activar Premium mensual</option>
          <option value="premium:anual">Activar Premium anual</option>
          <option value="free">Quitar Premium</option>
        </select>`;
      listaEl.appendChild(row);
    }
    usuarias.appendChild(listaEl);
    usuarias.querySelectorAll('.admin-plan-sel').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const val = sel.value;
        if (!val) return;
        const uid = sel.closest('[data-uid]').dataset.uid;
        const [plan, periodo] = val.split(':');
        sel.disabled = true;
        try {
          await adminSetPlan(uid, plan, periodo || null);
          toast(plan === 'premium' ? `Premium ${periodo} activado.` : 'Premium quitado.');
          recargar(container);
        } catch (err) {
          toast('No se pudo aplicar el cambio: ' + (err.message || 'error desconocido'));
          sel.disabled = false;
          sel.value = '';
        }
      });
    });
  }
  container.appendChild(usuarias);

  // --- Churn ---
  const ch = d.churn;
  const churn = document.createElement('div');
  churn.className = 'card';
  churn.innerHTML = `
    <h2>📉 Churn — ${mesTexto}</h2>
    <div class="chips mt">
      <span class="tag">${ch.voluntario_mes} voluntario${ch.voluntario_mes === 1 ? '' : 's'} (canceló, sigue activo hasta que termine lo pagado)</span>
      <span class="tag rojo">${ch.involuntario_mes} involuntario${ch.involuntario_mes === 1 ? '' : 's'} (reembolso, contracargo o pago vencido)</span>
    </div>`;
  if (ch.detalle_involuntario?.length) {
    const fecha2 = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
    churn.insertAdjacentHTML('beforeend', `
      <p class="small mt" style="font-weight:600">Eventos de este mes:</p>
      ${ch.detalle_involuntario.slice(0, 15).map((ev) => `<div class="habit"><label>${fecha2(ev.fecha)} · ${esc(ev.email)}</label><span class="small muted">${ev.evento}</span></div>`).join('')}`);
  } else {
    churn.insertAdjacentHTML('beforeend', '<p class="small muted mt">Sin eventos de churn este mes.</p>');
  }
  container.appendChild(churn);

  // --- Uso de Sana ---
  const s = d.uso_sana;
  const sana = document.createElement('div');
  sana.className = 'card';
  sana.innerHTML = `
    <h2>💬 Uso de SuSana</h2>
    <p class="small mt">${s.mensajes_mes} mensajes este mes, de ${s.usuarias_activas_mes} usuario${s.usuarias_activas_mes === 1 ? '' : 's'} distinto${s.usuarias_activas_mes === 1 ? '' : 's'}.</p>`;
  container.appendChild(sana);

  // --- No medido todavía ---
  const noMedido = document.createElement('div');
  noMedido.className = 'card';
  noMedido.innerHTML = `
    <h2>📋 No medido todavía</h2>
    <p class="small muted mt">Con pocos usuarios, estos números no dirían nada real todavía — se activan solos cuando haya más historia:</p>
    <ul class="steps small mt">${d.no_medido.map((m) => `<li>${m}</li>`).join('')}</ul>`;
  container.appendChild(noMedido);
}
