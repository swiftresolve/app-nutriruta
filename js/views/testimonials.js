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
    <p class="small">Solo aparecen aquí los check-ins que autorizaste compartir. Copia el texto y úsalo donde quieras.</p>`;
  container.appendChild(title);

  const { checkins } = getState();
  const compartidos = checkins.filter((c) => c.compartir === true);

  if (!compartidos.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = '<p class="small muted">Todavía no tienes testimonios autorizados.</p>';
    container.appendChild(empty);
    return;
  }

  for (const c of [...compartidos].reverse()) {
    const card = document.createElement('div');
    card.className = 'card';
    const texto = buildTexto(c);
    card.innerHTML = `
      <p class="small muted">${c.fecha}</p>
      <p class="mt">${esc(texto)}</p>
      <button class="btn ghost sm mt">📋 Copiar texto</button>`;
    card.querySelector('.btn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(texto);
        toast('Copiado ✅');
      } catch {
        toast('No se pudo copiar. Selecciona el texto manualmente.');
      }
    });
    container.appendChild(card);
  }
}

function buildTexto(c) {
  const partes = [`Ánimo: ${labelAnimo(c.animo)}`, `Menú: ${labelExperiencia(c.menuExperiencia)}`];
  if (c.notas) partes.push(`"${c.notas}"`);
  return partes.join(' · ');
}
