// Panel de administración: solo para correos en admin_emails, verificado
// en el servidor (admin_dashboard, ver migración). Esta vista no decide
// nada de acceso — solo pide los datos y muestra "No autorizado" si el
// servidor los niega.
import { fetchAdminDashboard } from '../supabase-client.js';
import { header } from '../app.js';
import { esc } from '../store.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function money(n) {
  return `$${Number(n ?? 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function renderAdmin(container) {
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
    usuarias.insertAdjacentHTML('beforeend', `
      <p class="small mt" style="font-weight:600">Detalle:</p>
      <div class="mt" style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem;white-space:nowrap">
          <thead><tr style="text-align:left;color:var(--ink-soft)">
            <th style="padding:4px 8px 4px 0">Correo</th><th style="padding:4px 8px">Plan</th>
            <th style="padding:4px 8px">Vence</th><th style="padding:4px 8px">Creada</th><th style="padding:4px 0">Último acceso</th>
          </tr></thead>
          <tbody>${u.detalle.map((r) => `
            <tr style="border-top:1px solid #EFF5F3">
              <td style="padding:5px 8px 5px 0">${esc(r.email)}${r.nombre ? ` <span class="muted">(${esc(r.nombre)})</span>` : ''}</td>
              <td style="padding:5px 8px">${r.plan === 'premium' ? `✨ ${esc(r.plan_periodo || '')}` : 'gratis'}</td>
              <td style="padding:5px 8px">${fecha(r.vence)}</td>
              <td style="padding:5px 8px">${fecha(r.creada)}</td>
              <td style="padding:5px 0">${fecha(r.ultimo_acceso)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`);
  }
  container.appendChild(usuarias);

  // --- Uso de Sana ---
  const s = d.uso_sana;
  const sana = document.createElement('div');
  sana.className = 'card';
  sana.innerHTML = `
    <h2>💬 Uso de Susana</h2>
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
