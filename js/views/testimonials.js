// Tarjetas de testimonios: solo check-ins que el usuario autorizó explícitamente
// a compartir (checkin.compartir === true). Pensada para copiar el texto y
// usarlo en redes / landing / pauta.
import { getState, esc } from '../store.js';
import { header, toast, navigate } from '../app.js';
import { labelAnimo, labelExperiencia } from './checkin.js';
import { t } from '../i18n.js';

export function renderTestimonials(container) {
  header(container);

  const back = document.createElement('button');
  back.className = 'link-btn small';
  back.textContent = t('← Volver a Progreso');
  back.addEventListener('click', () => navigate('progress'));
  container.appendChild(back);

  const title = document.createElement('div');
  title.className = 'card';
  title.innerHTML = `<h2>🎙️ ${t('Tus testimonios')}</h2>
    <p class="small">${t('Solo aparecen aquí tus check-ins y reflexiones del plan de 7 días que autorizaste compartir. Copia el texto y úsalo donde quieras.')}</p>`;
  container.appendChild(title);

  const { checkins, emergencia } = getState();
  const checkinsCompartidos = checkins.filter((c) => c.compartir === true).map((c) => ({
    fecha: c.fecha, texto: buildTextoCheckin(c)
  }));

  const reflexionesCompartidas = [];
  if (emergencia?.compartirReflexiones === true && emergencia.reflexiones) {
    for (const [diaN, texto] of Object.entries(emergencia.reflexiones)) {
      if (!texto || !texto.trim()) continue;
      reflexionesCompartidas.push({ fecha: t('Plan de 7 días · Día {n}', { n: diaN }), texto });
    }
  }

  const todos = [...checkinsCompartidos, ...reflexionesCompartidas];

  if (!todos.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `<p class="small muted">${t('Todavía no tienes testimonios autorizados.')}</p>`;
    container.appendChild(empty);
    return;
  }

  for (const item of [...todos].reverse()) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <p class="small muted">${esc(item.fecha)}</p>
      <p class="mt">${esc(item.texto)}</p>
      <button class="btn ghost sm mt">📋 ${t('Copiar texto')}</button>`;
    card.querySelector('.btn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(item.texto);
        toast(t('Copiado ✅'));
      } catch {
        toast(t('No se pudo copiar. Selecciona el texto manualmente.'));
      }
    });
    container.appendChild(card);
  }
}

function buildTextoCheckin(c) {
  const partes = [t('Ánimo: {v}', { v: labelAnimo(c.animo) }), t('Menú: {v}', { v: labelExperiencia(c.menuExperiencia) })];
  if (c.notas) partes.push(`"${c.notas}"`);
  return partes.join(' · ');
}
