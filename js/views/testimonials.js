// Tarjetas de testimonios: solo check-ins que el usuario autorizó explícitamente
// a compartir (checkin.compartir === true). Pensada para copiar el texto y
// usarlo en redes / landing / pauta.
import { getState, esc } from '../store.js';
import { header, toast, navigate } from '../app.js';
import { labelAnimo, labelExperiencia } from './checkin.js';

export function renderTestimonials(container) {
  header(container);

  const back = document.createElement('button');
  back.className = 'link-btn small';
  back.textContent = '← Volver a Progreso';
  back.addEventListener('click', () => navigate('progress'));
  container.appendChild(back);

  const title = document.createElement('div');
  title.className = 'card';
  title.innerHTML = `<h2>🎙️ Tus testimonios</h2>
    <p class="small">Solo aparecen aquí tus check-ins y reflexiones del plan de 7 días que autorizaste compartir. Copia el texto y úsalo donde quieras.</p>`;
  container.appendChild(title);

  const { checkins, emergencia } = getState();
  const checkinsCompartidos = checkins.filter((c) => c.compartir === true).map((c) => ({
    fecha: c.fecha, texto: buildTextoCheckin(c)
  }));

  const reflexionesCompartidas = [];
  if (emergencia?.compartirReflexiones === true && emergencia.reflexiones) {
    for (const [diaN, texto] of Object.entries(emergencia.reflexiones)) {
      if (!texto || !texto.trim()) continue;
      reflexionesCompartidas.push({ fecha: `Plan de 7 días · Día ${diaN}`, texto });
    }
  }

  const todos = [...checkinsCompartidos, ...reflexionesCompartidas];

  if (!todos.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = '<p class="small muted">Todavía no tienes testimonios autorizados.</p>';
    container.appendChild(empty);
    return;
  }

  for (const t of [...todos].reverse()) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <p class="small muted">${esc(t.fecha)}</p>
      <p class="mt">${esc(t.texto)}</p>
      <button class="btn ghost sm mt">📋 Copiar texto</button>`;
    card.querySelector('.btn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(t.texto);
        toast('Copiado ✅');
      } catch {
        toast('No se pudo copiar. Selecciona el texto manualmente.');
      }
    });
    container.appendChild(card);
  }
}

function buildTextoCheckin(c) {
  const partes = [`Ánimo: ${labelAnimo(c.animo)}`, `Menú: ${labelExperiencia(c.menuExperiencia)}`];
  if (c.notas) partes.push(`"${c.notas}"`);
  return partes.join(' · ');
}
