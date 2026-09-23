// Cámara en vivo dentro de la app (no el selector nativo del sistema) --
// UN SOLO módulo compartido por cualquier pantalla que necesite tomar una
// foto en vivo (mealLogModal.js para "¿Qué comiste?", planner.js para
// "Crear con IA desde foto"), para que la experiencia sea EXACTAMENTE
// igual sin importar desde dónde se abra (pedido explícito de la usuaria:
// antes había dos implementaciones distintas, una completa con selector
// de lentes/zoom/detección de pantalla negra, y otra mucho más simple sin
// nada de eso -- se sentía como una cámara distinta según la pantalla).
//
// Todo el trabajo real de esta cámara (lentes físicas, zoom con números
// reales, gesto de pellizco, detección de sensores auxiliares en negro)
// se armó y depuró primero en mealLogModal.js -- ver el historial de esa
// pantalla para el porqué de cada detalle. Este módulo es esa misma
// lógica, generalizada.
import { toast, INFO_ICON } from './app.js';
import { t } from './i18n.js';

// Devuelve la instrucción de la pantalla de cámara ya montada. `modal` es
// el elemento donde se pinta la UI (su innerHTML se reemplaza por
// completo). `onCapturar(canvasCuadrado)` recibe el frame ya recortado a
// cuadrado -- el llamador decide qué hacer con él (reescalar, subir,
// mandar a la IA). `onGaleria`/`onCancelar` dejan que cada pantalla
// decida a dónde volver -- esta función no conoce esas pantallas.
export async function abrirCamaraEnVivo({ modal, instruccion, onCapturar, onGaleria, onCancelar }) {
  let stream = null;
  function detenerCamara() {
    if (stream) { stream.getTracks().forEach((tr) => tr.stop()); stream = null; }
  }

  // Pantalla completa (fondo negro de borde a borde), mismo lenguaje
  // visual en toda la app: instrucción arriba, marco redondeado grande,
  // obturador circular blanco abajo con galería/cancelar como íconos
  // secundarios a los lados (referencia real: Fitia).
  const backdrop = modal.parentElement;
  backdrop?.classList.add('cam-fullscreen');
  function salirFullscreen() { backdrop?.classList.remove('cam-fullscreen'); }

  modal.innerHTML = `
    <div class="camera-top">
      <button type="button" class="camera-cancelar" id="cam-cancelar">${t('Cancelar')}</button>
      <button type="button" class="camera-info-btn" id="cam-info" aria-label="${t('Consejos para la foto')}">${INFO_ICON}</button>
    </div>
    <p class="camera-instruccion">${instruccion}</p>
    <div class="camera-wrap">
      <video id="cam-video" autoplay playsinline muted></video>
      <div class="camera-frame"></div>
    </div>
    <div class="camera-lentes-row" id="cam-lentes" hidden></div>
    <div class="camera-zoom-dial" id="cam-zoom" hidden></div>
    <div class="camera-controls">
      <button type="button" class="camera-icon-btn" id="cam-galeria" aria-label="${t('Elegir de la galería')}">🖼️</button>
      <button type="button" id="cam-shutter" class="camera-shutter" aria-label="${t('Tomar foto')}"></button>
      <span class="camera-icon-btn" style="visibility:hidden" aria-hidden="true"></span>
    </div>`;

  modal.querySelector('#cam-cancelar').addEventListener('click', () => { detenerCamara(); salirFullscreen(); onCancelar(); });
  modal.querySelector('#cam-galeria').addEventListener('click', () => { detenerCamara(); salirFullscreen(); onGaleria(); });
  modal.querySelector('#cam-info').addEventListener('click', mostrarConsejos);

  const video = modal.querySelector('#cam-video');
  const wrap = modal.querySelector('.camera-wrap');
  const lentesRow = modal.querySelector('#cam-lentes');
  const zoomRow = modal.querySelector('#cam-zoom');
  let trackActual = null;
  let capsActuales = null;

  // "1x", "2x", "3.5x" -- redondeado a 1 decimal, sin el ".0" cuando es
  // un número entero.
  function formatoX(v) {
    const r = Math.round(v * 10) / 10;
    return `${Number.isInteger(r) ? r : r.toFixed(1)}x`;
  }

  // Actualiza el disco de zoom en pantalla sin volver a pintarlo -- la
  // usa tanto el arrastre del dedo sobre la propia barra como el gesto de
  // pellizco (más abajo), para que ambos se vean sincronizados.
  let pintarZoomUI = null;

  // Barra de zoom CONTINUA (arrastre con el dedo), no botones con 3
  // paradas fijas -- pedido explícito: "que el zoom sea graduable con la
  // ruedita que gira, como en los celulares normalmente". El rango real
  // (min/max) sí lo entrega el navegador con exactitud, a diferencia de
  // qué lente es cuál -- eso queda en la fila de lentes aparte.
  function renderZoom() {
    if (!capsActuales?.zoom || capsActuales.zoom.max <= capsActuales.zoom.min) {
      zoomRow.innerHTML = ''; zoomRow.hidden = true; pintarZoomUI = null; return;
    }
    const { min, max } = capsActuales.zoom;
    zoomRow.hidden = false;
    zoomRow.innerHTML = `
      <span class="camera-zoom-tope">${formatoX(min)}</span>
      <div class="camera-zoom-track" id="cam-zoom-track">
        <div class="camera-zoom-fill" id="cam-zoom-fill"></div>
        <div class="camera-zoom-thumb" id="cam-zoom-thumb">${formatoX(min)}</div>
      </div>
      <span class="camera-zoom-tope">${formatoX(max)}</span>`;
    const track = zoomRow.querySelector('#cam-zoom-track');
    const fill = zoomRow.querySelector('#cam-zoom-fill');
    const thumb = zoomRow.querySelector('#cam-zoom-thumb');

    pintarZoomUI = (v) => {
      const pct = Math.min(1, Math.max(0, (v - min) / (max - min)));
      thumb.style.left = `${pct * 100}%`;
      fill.style.width = `${pct * 100}%`;
      thumb.textContent = formatoX(v);
    };
    function aplicarDesdeX(clientX) {
      const rect = track.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const v = min + pct * (max - min);
      pintarZoomUI(v);
      trackActual.applyConstraints({ advanced: [{ zoom: v }] }).catch(() => {});
    }
    let arrastrando = false;
    track.addEventListener('pointerdown', (e) => {
      arrastrando = true;
      track.setPointerCapture(e.pointerId);
      aplicarDesdeX(e.clientX);
    });
    track.addEventListener('pointermove', (e) => { if (arrastrando) aplicarDesdeX(e.clientX); });
    const soltar = () => { arrastrando = false; };
    track.addEventListener('pointerup', soltar);
    track.addEventListener('pointercancel', soltar);
    pintarZoomUI(trackActual.getSettings().zoom ?? min);
  }

  // Mini modal de consejos (referencia real: el botón "i" de Fitia al
  // abrir su cámara) -- se muestra a pedido, no automático, para no
  // interponerse cada vez que alguien ya sabe cómo tomar la foto.
  function mostrarConsejos() {
    const overlay = document.createElement('div');
    overlay.className = 'camera-consejos-overlay';
    overlay.innerHTML = `
      <div class="camera-consejos-card">
        <h3 class="center">${t('Cómo obtener un resultado más preciso')}</h3>
        <div class="camera-consejos-grid">
          <div class="camera-consejo ok"><span class="camera-consejo-check">✓</span>${t('Comida dentro del marco')}</div>
          <div class="camera-consejo mal"><span class="camera-consejo-check">✕</span>${t('Comida muy cerca o cortada')}</div>
          <div class="camera-consejo ok"><span class="camera-consejo-check">✓</span>${t('Todos los alimentos visibles')}</div>
          <div class="camera-consejo mal"><span class="camera-consejo-check">✕</span>${t('Alimentos tapados o amontonados')}</div>
        </div>
        <button type="button" class="btn accent full mt" id="cam-consejos-listo">${t('Listo')}</button>
      </div>`;
    modal.appendChild(overlay);
    overlay.querySelector('#cam-consejos-listo').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  // Muchos Android exponen sensores auxiliares (macro, profundidad,
  // monocromo) como si fueran lentes traseras normales en
  // enumerateDevices() -- no hay ninguna capability que diga "esta es una
  // cámara de foto real", así que la única forma de saberlo es real:
  // pedirle un frame y mirar si es negro.
  function esperarPrimerFrame(timeoutMs = 1200) {
    return new Promise((resolve) => {
      if (video.readyState >= 2) { resolve(); return; }
      const listo = () => { video.removeEventListener('loadeddata', listo); resolve(); };
      video.addEventListener('loadeddata', listo);
      setTimeout(() => { video.removeEventListener('loadeddata', listo); resolve(); }, timeoutMs);
    });
  }
  const canvasSonda = document.createElement('canvas');
  canvasSonda.width = 6; canvasSonda.height = 6;
  const ctxSonda = canvasSonda.getContext('2d', { willReadFrequently: true });
  function promedioLuminancia() {
    if (!video.videoWidth) return null;
    try {
      ctxSonda.drawImage(video, 0, 0, 6, 6);
      const { data } = ctxSonda.getImageData(0, 0, 6, 6);
      let total = 0;
      for (let i = 0; i < data.length; i += 4) total += data[i] + data[i + 1] + data[i + 2];
      return total / (data.length / 4);
    } catch { return null; }
  }
  // "No sé todavía" nunca debe tratarse igual que "confirmé que está
  // negro" -- si no hay certeza (sin dimensiones aún), se asume que la
  // cámara está bien y se sigue de largo (bug real ya corregido: tratar
  // la incertidumbre como negro rompía la cámara para cualquiera cuyo
  // teléfono tardara un poco más en entregar el primer frame).
  function esFrameNegro() {
    const p = promedioLuminancia();
    return p !== null && p < 6;
  }

  // Arranca (o reinicia, al cambiar de lente) el stream de video. Sin
  // aspectRatio ni forzar zoom automático al mínimo -- ambas cosas
  // probadas y descartadas: la primera hacía que varios Android
  // recortaran el sensor en vez de solo escalarlo, y la segunda es causa
  // real y documentada de video en negro en Chrome para Android reciente.
  async function iniciarStream(deviceId) {
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    // "ideal", no "exact" -- con "exact" varios Android (confirmado real,
    // no solo un celular) tiraban OverconstrainedError al cambiar de lente
    // apenas se soltaba la anterior, dejando SOLO la lente 1 utilizable
    // ("los botones de lente no sirven"). "ideal" deja que el navegador
    // use esa lente igual (casi siempre la respeta) pero sin reventar si
    // por un instante no puede cumplir el resto de las restricciones.
    const videoConstraint = deviceId ? { deviceId: { ideal: deviceId } } : { facingMode: { ideal: 'environment' } };
    stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: false });
    video.srcObject = stream;
    trackActual = stream.getVideoTracks()[0];
    capsActuales = trackActual?.getCapabilities?.();
    renderZoom();
  }

  // Gesto de pellizco para acercar/alejar, como cualquier cámara nativa --
  // sincronizado con la misma barra de zoom (pintarZoomUI), no un cálculo
  // aparte, para que ambos controles nunca se vean en desacuerdo.
  let zoomInicial = 1, distanciaInicial = 0;
  wrap.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 2 || !capsActuales?.zoom) return;
    distanciaInicial = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    zoomInicial = trackActual.getSettings().zoom ?? capsActuales.zoom.min;
  });
  wrap.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || !distanciaInicial || !capsActuales?.zoom) return;
    e.preventDefault();
    const distanciaActual = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const factor = distanciaActual / distanciaInicial;
    const nuevoZoom = Math.min(capsActuales.zoom.max, Math.max(capsActuales.zoom.min, zoomInicial * factor));
    pintarZoomUI?.(nuevoZoom);
    trackActual.applyConstraints({ advanced: [{ zoom: nuevoZoom }] }).catch(() => {});
  }, { passive: false });
  wrap.addEventListener('touchend', () => { distanciaInicial = 0; });

  // SIEMPRE arranca con el criterio genérico (facingMode environment),
  // nunca recordando una lente elegida en una sesión anterior -- si esa
  // lente resultaba ser un sensor auxiliar sin imagen real, la cámara
  // quedaba en negro cada vez que se abría, sin forma visible de
  // arreglarlo. La fila de lentes deja probar otra dentro de esta misma
  // sesión, pero nunca se guarda para la próxima vez.
  try {
    await iniciarStream();
  } catch {
    salirFullscreen();
    toast(t('No pudimos abrir la cámara. Elige una foto de tu galería.'));
    onGaleria();
    return { detener: detenerCamara };
  }
  await esperarPrimerFrame();

  // Fila de botones, uno por cada lente trasera física que detecte el
  // celular -- no se pueden etiquetar como "gran angular/1x/2x" (el
  // navegador no expone qué multiplicador óptico tiene cada una), así
  // que se numeran y la usuaria prueba cuál busca.
  try {
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    const traseras = dispositivos.filter((d) => d.kind === 'videoinput' && !/front|user|selfie|frontal/i.test(d.label));

    // El criterio genérico (facingMode:environment) NO siempre elige la
    // lente principal -- bug real reportado: en un Huawei abría en la
    // 3ra lente enumerada, una especie de macro desenfocada y pegada al
    // objeto, sin que esFrameNegro() lo detectara (da una imagen real,
    // solo que inservible). Como sí hay control real sobre CUÁL lente
    // pedir por deviceId, se prueba forzar la primera de la lista apenas
    // se sabe que existe más de una -- casi siempre es la principal en
    // Android. Si esa resulta negra, se vuelve a lo que ya estaba
    // funcionando (el criterio genérico), nunca se deja peor de como
    // llegó.
    if (traseras.length > 1 && trackActual?.getSettings().deviceId !== traseras[0].deviceId) {
      const generica = trackActual?.getSettings().deviceId;
      try {
        await iniciarStream(traseras[0].deviceId);
        await esperarPrimerFrame();
        if (esFrameNegro()) throw new Error('primera lente negra');
      } catch {
        if (generica) { try { await iniciarStream(generica); } catch { /* se queda como esté */ } }
      }
    }

    if (traseras.length > 1) {
      lentesRow.hidden = false;
      lentesRow.innerHTML = traseras.map((d, i) => `<button type="button" class="camera-lente-btn" data-device-id="${d.deviceId}">${t('Lente')} ${i + 1}</button>`).join('');
      function marcarLenteActiva() {
        const idActual = trackActual?.getSettings().deviceId;
        lentesRow.querySelectorAll('.camera-lente-btn').forEach((b) => b.classList.toggle('active', b.dataset.deviceId === idActual));
      }
      marcarLenteActiva();
      lentesRow.querySelectorAll('.camera-lente-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const deviceIdAnterior = trackActual?.getSettings().deviceId;
          try {
            await iniciarStream(btn.dataset.deviceId);
          } catch {
            // Algunos Android no sueltan la lente anterior de inmediato
            // (stop() en JS vuelve antes de que el hardware la libere de
            // verdad) -- un reintento corto después de una pequeña espera
            // basta para esos casos, antes de rendirse con el error.
            try {
              await new Promise((r) => setTimeout(r, 300));
              await iniciarStream(btn.dataset.deviceId);
            } catch { toast(t('No se pudo cambiar de lente.')); return; }
          }
          marcarLenteActiva();
          await esperarPrimerFrame();
          if (esFrameNegro()) {
            toast(t('Esa lente no sirve para fotos en este celular -- volviendo a la anterior.'));
            await iniciarStream(deviceIdAnterior);
            marcarLenteActiva();
          }
        });
      });
    }
  } catch { /* enumerar dispositivos falló -- se deja sin fila de lentes */ }

  modal.querySelector('#cam-shutter').addEventListener('click', () => {
    // Último control antes de gastar una llamada de IA en una foto
    // inservible: si el frame actual sigue negro, mejor avisar que dejar
    // a la usuaria esperando un análisis que nunca va a reconocer nada.
    if (esFrameNegro()) {
      toast(t('No se ve nada en la cámara -- prueba con otra lente o elige una foto de tu galería.'));
      return;
    }
    // Recorte cuadrado centrado del frame actual, coherente con el marco
    // que se le muestra a la usuaria -- antes la cámara de "Crear con IA
    // desde foto" mostraba el mismo marco cuadrado pero capturaba el
    // rectángulo completo sin recortar, otra inconsistencia real entre
    // las dos cámaras que existían.
    const w = video.videoWidth, h = video.videoHeight;
    const cropSide = Math.min(w, h);
    const cuadro = document.createElement('canvas');
    cuadro.width = cropSide; cuadro.height = cropSide;
    cuadro.getContext('2d').drawImage(video, (w - cropSide) / 2, (h - cropSide) / 2, cropSide, cropSide, 0, 0, cropSide, cropSide);
    detenerCamara();
    salirFullscreen();
    onCapturar(cuadro);
  });

  return { detener: detenerCamara };
}
