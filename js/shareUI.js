// Carrusel para elegir plantilla antes de compartir (ver shareTemplates.js
// para el motor que arma cada imagen). Vive separado de shareTemplates.js
// porque necesita openModal/toast/navigate de app.js -- shareTemplates.js
// en cambio no depende de app.js, para que el motor de dibujo se pueda
// reutilizar en el futuro (ej. una vista previa fuera de un modal) sin
// arrastrar nada de UI.
//
// Import circular con app.js a propósito (app.js también llama a
// abrirCompartirPlantillas desde el modal "Mis Rachas"): seguro porque
// todo lo importado de acá se usa DENTRO de una función (el click del
// carrusel), nunca en un const a nivel de módulo evaluado al cargar --
// ver memoria "imports circulares con app.js tumban la app entera".
import { openModal, toast, navigate, SHARE_ICON } from './app.js';
import { generarImagen, generarPreviewURL, plantillasDisponibles, FUENTES_DISPONIBLES } from './shareTemplates.js';

async function compartirBlob(blob, nombreArchivo) {
  const file = new File([blob], nombreArchivo, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'NutriRuta' });
    } catch (err) {
      if (err?.name !== 'AbortError') toast('No se pudo compartir.');
    }
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Imagen descargada — ya la puedes compartir 💚');
  }
}

// content: ver shape genérico en shareTemplates.js.
export function abrirCompartirPlantillas(content) {
  openModal((modal, closeFn) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <h2 class="center">Elige tu plantilla</h2>
      <p class="small muted center mt">Desliza para ver las opciones. Se arma en tu teléfono, nunca se sube a ningún lado hasta que tú decidas compartirla.</p>
      <div class="chips mt center" id="share-fuentes"></div>
      <div class="share-carrusel mt" id="share-lista"></div>`;
    modal.appendChild(wrap);

    // Elegir la letra es independiente de elegir la plantilla -- pedido
    // explícito: al menos 3-4 tipos de letra entre los que elegir (antes
    // solo existía Caveat). Cambiar de fuente vuelve a pintar TODAS las
    // vistas previas con la elegida, para comparar antes de compartir.
    let fuenteId = FUENTES_DISPONIBLES[0].id;
    const fuentesWrap = wrap.querySelector('#share-fuentes');
    FUENTES_DISPONIBLES.forEach((f) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (f.id === fuenteId ? ' selected' : '');
      chip.style.fontFamily = f.familia;
      chip.textContent = f.nombre;
      chip.addEventListener('click', () => {
        fuenteId = f.id;
        fuentesWrap.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
        chip.classList.add('selected');
        pintarTodas();
      });
      fuentesWrap.appendChild(chip);
    });

    const lista = wrap.querySelector('#share-lista');
    const disponibles = plantillasDisponibles();
    const cards = disponibles.map((tpl) => {
      const card = document.createElement('div');
      card.className = 'share-card' + (tpl.bloqueada ? ' bloqueada' : '');
      card.innerHTML = `
        <div class="share-card-preview" id="prev-${tpl.id}"><div class="share-card-loading">🌿</div></div>
        <p class="small center mt-xs" style="font-weight:700">${tpl.nombre} · ${tpl.tema}</p>
        <button type="button" class="btn ${tpl.bloqueada ? 'ghost' : 'accent'} sm full" data-id="${tpl.id}">
          ${tpl.bloqueada ? '🔒 Solo Premium' : `${SHARE_ICON}Compartir`}
        </button>`;
      lista.appendChild(card);

      const btn = card.querySelector('button');
      if (tpl.bloqueada) {
        btn.addEventListener('click', () => { closeFn(); navigate('plans'); });
      } else {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const original = btn.innerHTML;
          btn.textContent = 'Preparando…';
          try {
            const blob = await generarImagen(tpl, content, fuenteId);
            await compartirBlob(blob, `nutriruta-${content.tipo}-${tpl.id}.jpg`);
          } catch {
            toast('No se pudo preparar la imagen.');
          } finally {
            btn.disabled = false;
            btn.innerHTML = original;
          }
        });
      }
      return { tpl, card };
    });

    // Vista previa real con los datos de verdad (no un boceto genérico).
    function pintarTodas() {
      cards.forEach(({ tpl, card }) => {
        generarPreviewURL(tpl, content, fuenteId).then((url) => {
          const prev = card.querySelector(`#prev-${tpl.id}`);
          prev.innerHTML = `<img src="${url}" alt="Vista previa plantilla ${tpl.nombre}">`;
        });
      });
    }
    pintarTodas();
  });
}
