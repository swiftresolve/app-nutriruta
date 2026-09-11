// Modal de "¿Qué comiste realmente?" — foto, voz o texto, siempre con una
// lista editable antes de guardar (nunca se guarda algo que la IA detectó
// sin que la usuaria lo confirme o corrija). No cuenta contra la cuota de
// SuSana ni requiere Premium (ver supabase-client.js / log-meal).
import { openModal, toast, CAMERA_SOLID_ICON, MIC_ICON, TEXTO_ICON } from '../app.js';
import { esc, guardarComidaRegistrada, today } from '../store.js';
import { detectarAlimentosFoto, detectarAlimentosTexto, uploadComidaFoto } from '../supabase-client.js';
import { t, getIdioma } from '../i18n.js';

// Tamaño de la foto que se GUARDA en el diario visual -- nítida en
// cualquier pantalla, sin disparar el peso del archivo.
const MAX_DIM_GUARDAR = 1600;
// Tamaño de la copia aparte que ve la IA para reconocer alimentos -- más
// grande no reconoce mejor la comida, solo cuesta más tokens de imagen en
// Anthropic (cobra por píxeles). Al mandar SIEMPRE esta misma copia
// normalizada, el costo por foto queda fijo sin importar qué resolución
// entregue el celular -- por eso el cobro en NutriCoins puede ser un
// número fijo por registro, no algo variable según la calidad de la foto
// (pedido explícito: la calidad que ve la usuaria en su diario nunca debe
// bajar por esto).
const MAX_DIM_IA = 1000;

function reescalar(canvasOrigen, maxDim, calidad) {
  const scale = Math.min(1, maxDim / Math.max(canvasOrigen.width, canvasOrigen.height));
  const w = Math.round(canvasOrigen.width * scale);
  const h = Math.round(canvasOrigen.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(canvasOrigen, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', calidad);
}

// Comprime la foto elegida de galería en el cliente antes de subirla (misma
// idea que el avatar) — no recorta a cuadrado, una comida no siempre lo es.
// Devuelve el Blob de buena calidad para guardar en el diario y, aparte,
// el base64 chico solo para que la IA identifique alimentos.
function toJpegBase64(file, maxDim = MAX_DIM_GUARDAR) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const origen = document.createElement('canvas');
      origen.width = img.width; origen.height = img.height;
      origen.getContext('2d').drawImage(img, 0, 0);
      const dataUrlGuardar = reescalar(origen, maxDim, 0.85);
      const dataUrlIA = reescalar(origen, MAX_DIM_IA, 0.82);
      URL.revokeObjectURL(img.src);
      fetch(dataUrlGuardar).then((r) => r.blob()).then((blob) => {
        resolve({ base64: dataUrlIA.split(',')[1], mediaType: 'image/jpeg', previewUrl: dataUrlGuardar, blob });
      });
    };
    img.onerror = () => reject(new Error(t('Imagen inválida.')));
    img.src = URL.createObjectURL(file);
  });
}

// Reconocimiento de voz nativo del navegador — gratis, sin servidor. Varía
// el soporte (Safari/iOS lo trae con prefijo, Firefox no lo trae en
// desktop), así que el botón de voz se oculta solo si no existe.
function speechRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function openMealLogModal(mealId, mealTitle, onSaved) {
  openModal((modal, closeFn) => {
    let alimentos = [];
    let fuente = null;
    let fotoBlob = null;
    let stream = null;

    function detenerCamara() {
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    }

    // El selector de foto NO vive dentro de modal.innerHTML (cada pantalla
    // lo reemplaza por completo) — se crea una sola vez en el body y se
    // reutiliza. Es solo el respaldo de "galería" cuando la cámara en vivo
    // no está disponible; sin capture="environment" a propósito, para que
    // sea el picker normal de archivos y no reabra la cámara del sistema.
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;
    document.body.appendChild(fileInput);
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const { base64, mediaType, previewUrl, blob } = await toJpegBase64(file);
        fotoBlob = blob;
        pantallaAnalizando(previewUrl);
        const detectados = await detectarAlimentosFoto(base64, mediaType);
        fuente = 'foto';
        pantallaConfirmar(detectados, previewUrl);
      } catch (err) {
        toast(err.message || t('No se pudo procesar la foto.'));
        pantallaElegir();
      }
    });

    // Si el modal se cierra por cualquier vía (✕, tocar fuera, guardar) hay
    // que apagar la cámara siempre — sin esto la lucecita queda prendida.
    const cierreObs = new MutationObserver(() => {
      if (!modal.isConnected) { detenerCamara(); fileInput.remove(); cierreObs.disconnect(); }
    });
    cierreObs.observe(document.body, { childList: true });

    function pantallaElegir() {
      detenerCamara();
      modal.innerHTML = `
        <h2>${t('¿Qué comiste en {mealTitle}?', { mealTitle: esc(mealTitle) })}</h2>
        <p class="small muted mt">${t('Regístralo con foto, voz o texto — puedes corregir la lista antes de guardar.')}</p>
        <div class="ml-opciones mt">
          <button type="button" class="ml-opcion" id="ml-foto" aria-label="${t('Foto')}"><span class="ml-opcion-circle">${CAMERA_SOLID_ICON}</span></button>
          ${speechRecognitionCtor() ? `<button type="button" class="ml-opcion" id="ml-voz" aria-label="${t('Voz')}"><span class="ml-opcion-circle">${MIC_ICON}</span></button>` : ''}
          <button type="button" class="ml-opcion" id="ml-texto" aria-label="${t('Texto')}"><span class="ml-opcion-circle">${TEXTO_ICON}</span></button>
        </div>`;

      modal.querySelector('#ml-foto').addEventListener('click', () => pantallaCamara());
      modal.querySelector('#ml-voz')?.addEventListener('click', () => pantallaVoz());
      modal.querySelector('#ml-texto').addEventListener('click', () => pantallaTexto());
    }

    // Cámara en vivo dentro de la app (no el selector nativo del sistema,
    // que saca a la usuaria de la PWA) — encuadre visual como el de Fitia,
    // pero con getUserMedia real en vez de <input capture>. Si el navegador
    // no soporta la API o se niega el permiso, cae a la galería (fileInput)
    // con un aviso, en vez de dejar la pantalla en blanco.
    async function pantallaCamara() {
      // Pantalla completa (fondo negro de borde a borde), mismo lenguaje
      // visual que la cámara de Fitia que mostró la usuaria: instrucción
      // arriba, marco redondeado grande, obturador circular blanco abajo
      // con galería/cancelar como íconos secundarios a los lados.
      const backdrop = modal.parentElement;
      backdrop.classList.add('cam-fullscreen');
      function salirFullscreen() { backdrop.classList.remove('cam-fullscreen'); }

      modal.innerHTML = `
        <div class="camera-top"><button type="button" class="camera-cancelar" id="ml-cam-cancelar">${t('Cancelar')}</button></div>
        <p class="camera-instruccion">${t('Toma una foto de tu comida')}</p>
        <div class="camera-wrap">
          <video id="ml-video" autoplay playsinline muted></video>
          <div class="camera-frame"></div>
        </div>
        <p id="ml-cam-debug" style="font-family:monospace;font-size:11px;color:#9be;white-space:pre-wrap;line-height:1.4;margin:6px 2px 0;min-height:1em"></p>
        <div class="camera-lentes-row" id="ml-cam-lentes" hidden></div>
        <div class="camera-zoom-row" id="ml-cam-zoom" hidden></div>
        <div class="camera-controls">
          <button type="button" class="camera-icon-btn" id="ml-cam-galeria" aria-label="${t('Elegir de la galería')}">🖼️</button>
          <button type="button" id="ml-shutter" class="camera-shutter" aria-label="${t('Tomar foto')}"></button>
          <span class="camera-icon-btn" style="visibility:hidden" aria-hidden="true"></span>
        </div>`;

      modal.querySelector('#ml-cam-cancelar').addEventListener('click', () => { detenerCamara(); salirFullscreen(); pantallaElegir(); });
      modal.querySelector('#ml-cam-galeria').addEventListener('click', () => { detenerCamara(); salirFullscreen(); fileInput.click(); });

      const video = modal.querySelector('#ml-video');
      const wrap = modal.querySelector('.camera-wrap');
      const lentesRow = modal.querySelector('#ml-cam-lentes');
      const zoomRow = modal.querySelector('#ml-cam-zoom');
      let trackActual = null;
      let capsActuales = null;

      // "1x", "2x", "3.5x" -- redondeado a 1 decimal, sin el ".0" cuando
      // es un número entero.
      function formatoX(v) {
        const r = Math.round(v * 10) / 10;
        return `${Number.isInteger(r) ? r : r.toFixed(1)}x`;
      }

      // Fila de botones de zoom CON NÚMEROS REALES (min/medio/máx que
      // reporta la propia lente activa) -- a diferencia de "qué lente es
      // la gran angular", el nivel de zoom sí es un dato que el navegador
      // entrega con exactitud, así que aquí sí podemos mostrar números
      // verificables en vez de adivinar etiquetas.
      function renderZoom() {
        if (!capsActuales?.zoom) { zoomRow.innerHTML = ''; zoomRow.hidden = true; return; }
        const { min, max } = capsActuales.zoom;
        const crudos = max > min ? [min, min + (max - min) / 2, max] : [min];
        const valores = [...new Set(crudos.map((v) => Math.round(v * 10) / 10))];
        zoomRow.innerHTML = valores.map((v) => `<button type="button" class="camera-zoom-btn" data-zoom="${v}">${formatoX(v)}</button>`).join('');
        zoomRow.hidden = false;
        marcarActivo(trackActual.getSettings().zoom ?? min);
        zoomRow.querySelectorAll('.camera-zoom-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const v = Number(btn.dataset.zoom);
            trackActual.applyConstraints({ advanced: [{ zoom: v }] }).then(() => marcarActivo(v)).catch(() => {});
          });
        });
      }
      function marcarActivo(zoomActual) {
        zoomRow.querySelectorAll('.camera-zoom-btn').forEach((b) => {
          b.classList.toggle('active', Math.abs(Number(b.dataset.zoom) - zoomActual) < 0.05);
        });
      }

      // Muchos Android exponen sensores auxiliares (macro, profundidad,
      // monocromo) como si fueran lentes traseras normales en
      // enumerateDevices() -- no hay ninguna capability que diga "esta es
      // una cámara de foto real", así que la única forma de saberlo es
      // real: pedirle un frame y mirar si es negro. Si lo es, esa lente
      // simplemente no sirve para tomar fotos en este teléfono, aunque el
      // navegador la haya dejado abrir sin error.
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
      // Devuelve el promedio de brillo del frame actual (0-255), o null si
      // todavía no se puede saber (sin dimensiones) o el canvas falló --
      // separado de esFrameNegro() para poder MOSTRAR el número real en el
      // panel de diagnóstico, no solo un sí/no.
      function promedioLuminancia() {
        if (!video.videoWidth) return null;
        try {
          ctxSonda.drawImage(video, 0, 0, 6, 6);
          const { data } = ctxSonda.getImageData(0, 0, 6, 6);
          let total = 0;
          for (let i = 0; i < data.length; i += 4) total += data[i] + data[i + 1] + data[i + 2];
          return total / (data.length / 4);
        } catch { return null; } // canvas contaminado u otro fallo
      }
      // BUG real de la primera versión de esto: si el video todavía no
      // tenía dimensiones (cámara lenta en arrancar, no le había dado
      // tiempo a los 500ms de espera), se trataba como "está en negro" y
      // eso disparaba el reintento/reversión de lente -- rompiendo la
      // cámara por defecto para CUALQUIERA cuyo teléfono tardara un poco
      // más en entregar el primer frame, no solo a quien tuviera un
      // sensor auxiliar real. "No sé todavía" nunca debe tratarse igual
      // que "confirmé que está negro" -- si no hay certeza, se asume que
      // la cámara está bien y se sigue de largo.
      function esFrameNegro() {
        const p = promedioLuminancia();
        return p !== null && p < 6;
      }

      // Panel de diagnóstico visible en pantalla (temporal, mientras se
      // investiga el reporte real de cámara en negro en varios celulares
      // -- ver feedback de la usuaria). Muestra datos que antes solo se
      // podían ver con la consola del navegador, para poder diagnosticar
      // desde una simple captura de pantalla en vez de seguir adivinando
      // arreglos a ciegas.
      const debugEl = modal.querySelector('#ml-cam-debug');
      function actualizarDebug() {
        if (!debugEl) return;
        const s = trackActual?.getSettings?.() ?? {};
        const lum = promedioLuminancia();
        debugEl.textContent =
          `video: ${video.videoWidth}x${video.videoHeight} readyState=${video.readyState}\n` +
          `track: ${trackActual?.label || '(sin label)'}\n` +
          `settings: zoom=${s.zoom ?? '-'} frameRate=${s.frameRate ?? '-'} facingMode=${s.facingMode ?? '-'}\n` +
          `brillo promedio: ${lum === null ? 'sin datos' : lum.toFixed(1)} (negro si <6)`;
      }

      // Arranca (o reinicia, al cambiar de lente) el stream de video. Sin
      // aspectRatio: pedirle al navegador un feed cuadrado (probado antes)
      // hace que varios Android recorten el sensor en vez de solo
      // escalarlo -- se sentía MÁS zoom, no menos. Se deja que el
      // navegador entregue su resolución nativa; el recorte cuadrado pasa
      // solo en CSS (.camera-wrap) y al capturar (más abajo).
      async function iniciarStream(deviceId) {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        const videoConstraint = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } };
        stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: false });
        video.srcObject = stream;
        trackActual = stream.getVideoTracks()[0];
        capsActuales = trackActual?.getCapabilities?.();
        // ANTES se forzaba el zoom al mínimo automáticamente aquí mismo,
        // apenas arrancaba el video (para no heredar el 2x que "environment"
        // a veces elegía por defecto). Se quita: aplicar una constraint de
        // zoom con applyConstraints() justo al abrir el stream es una causa
        // real y documentada de video en negro en versiones recientes de
        // Chrome para Android, en varios modelos a la vez -- coincide
        // exactamente con lo reportado (todas las lentes en negro, en
        // varios celulares, algo que antes sí funcionaba). El zoom real
        // (fila de botones y pellizco) sigue intacto, pero ahora solo se
        // aplica cuando la usuaria lo toca a propósito, nunca solo.
        renderZoom();
      }

      // Gesto de pellizco para acercar/alejar, como cualquier cámara nativa
      // (pedido explícito, referencia real: Fitia). Se registra UNA sola
      // vez y siempre lee trackActual/capsActuales (variables mutables),
      // así sigue funcionando si la usuaria cambia de lente a mitad de la
      // sesión de cámara.
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
        trackActual.applyConstraints({ advanced: [{ zoom: nuevoZoom }] }).catch(() => {});
      }, { passive: false });
      wrap.addEventListener('touchend', () => { distanciaInicial = 0; });

      // SIEMPRE arranca con el criterio genérico (facingMode environment),
      // nunca recordando una lente elegida en una sesión anterior. Esto
      // reemplaza un intento anterior que sí la recordaba (localStorage) --
      // si esa lente recordada resultaba ser un sensor auxiliar sin
      // imagen real (macro/profundidad, ver esFrameNegro), la cámara
      // quedaba en negro CADA VEZ que se abría, sin ninguna forma visible
      // de arreglarlo desde la propia pantalla. La fila de lentes de abajo
      // sigue dejando probar otra lente dentro de esta misma sesión de
      // cámara, pero nunca se guarda para la próxima vez.
      try {
        await iniciarStream();
      } catch {
        salirFullscreen();
        toast(t('No pudimos abrir la cámara. Elige una foto de tu galería.'));
        fileInput.click();
        return;
      }
      await esperarPrimerFrame();
      actualizarDebug();
      // Se refresca un par de veces más -- algunos celulares reportan
      // videoWidth/label con retraso incluso después de "loadeddata".
      setTimeout(actualizarDebug, 800);
      setTimeout(actualizarDebug, 2000);

      // Fila de botones, uno por cada lente trasera física que detecte el
      // celular (pedido explícito: el zoom mínimo que reporta la lente que
      // el navegador elige por defecto puede seguir sintiéndose "cerca" en
      // algunos Android). No se pueden etiquetar como "gran angular/1x/2x"
      // -- el navegador no expone qué multiplicador óptico tiene cada
      // lente física, solo cuántas hay, así que se numeran y la usuaria
      // prueba cuál es la que busca. Las etiquetas de los dispositivos
      // solo están disponibles DESPUÉS de dar permiso de cámara, por eso
      // se enumera acá y no antes. iOS Safari no da pistas útiles en el
      // label -- si no hay más de un candidato claro, la fila se queda
      // oculta en vez de ofrecer un cambio que no serviría de nada.
      try {
        const dispositivos = await navigator.mediaDevices.enumerateDevices();
        const traseras = dispositivos.filter((d) => d.kind === 'videoinput' && !/front|user|selfie|frontal/i.test(d.label));
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
                marcarLenteActiva();
                await esperarPrimerFrame();
                actualizarDebug();
                if (esFrameNegro()) {
                  // Esta lente física existe y el navegador la deja abrir,
                  // pero no entrega una imagen real (sensor auxiliar de
                  // macro/profundidad, no una cámara de foto normal) --
                  // se vuelve a la anterior en vez de dejar el cuadro negro.
                  toast(t('Esa lente no sirve para fotos en este celular -- volviendo a la anterior.'));
                  await iniciarStream(deviceIdAnterior);
                  marcarLenteActiva();
                }
              } catch { toast(t('No se pudo cambiar de lente.')); }
            });
          });
        }
      } catch { /* enumerar dispositivos falló -- se deja sin fila de lentes */ }

      modal.querySelector('#ml-shutter').addEventListener('click', () => {
        actualizarDebug();
        // Último control antes de gastar una llamada de IA en una foto
        // inservible: si el frame actual sigue negro (lente auxiliar que
        // se coló sin que el chequeo de arriba lo detectara a tiempo),
        // mejor avisar que dejar a la usuaria esperando un análisis que
        // nunca va a reconocer nada en un cuadro negro.
        if (esFrameNegro()) {
          toast(t('No se ve nada en la cámara -- prueba con otra lente o elige una foto de tu galería.'));
          return;
        }
        // Recorte cuadrado centrado del frame actual del video, coherente
        // con el encuadre que se le muestra a la usuaria. El lado del
        // recorte se limita a MAX_DIM_GUARDAR para no disparar el peso del
        // archivo, pero la que se guarda de verdad en el diario mantiene
        // buena calidad -- la copia chica para la IA (MAX_DIM_IA) es
        // aparte, la usuaria nunca la ve. Ver comentario de MAX_DIM_IA
        // arriba: por qué el costo de la IA queda fijo sin importar la
        // resolución que entregue el celular.
        const w = video.videoWidth, h = video.videoHeight;
        const cropSide = Math.min(w, h);
        const origen = document.createElement('canvas');
        origen.width = cropSide; origen.height = cropSide;
        origen.getContext('2d').drawImage(video, (w - cropSide) / 2, (h - cropSide) / 2, cropSide, cropSide, 0, 0, cropSide, cropSide);
        detenerCamara();
        salirFullscreen();
        const previewUrl = reescalar(origen, MAX_DIM_GUARDAR, 0.85);
        const base64IA = reescalar(origen, MAX_DIM_IA, 0.82).split(',')[1];
        fetch(previewUrl).then((r) => r.blob()).then(async (blob) => {
          fotoBlob = blob;
          pantallaAnalizando(previewUrl);
          try {
            const detectados = await detectarAlimentosFoto(base64IA, 'image/jpeg');
            fuente = 'foto';
            pantallaConfirmar(detectados, previewUrl);
          } catch (err) {
            toast(err.message || t('No se pudo procesar la foto.'));
            pantallaElegir();
          }
        });
      });
    }

    function pantallaAnalizando(previewUrl) {
      modal.innerHTML = `
        <h2>${t('Analizando…')}</h2>
        ${previewUrl ? `<img src="${previewUrl}" alt="" style="width:100%;border-radius:12px;margin-top:10px">` : ''}
        <p class="small muted mt center">${t('Un momento, estamos identificando lo que comiste.')}</p>`;
    }

    function pantallaVoz() {
      const Ctor = speechRecognitionCtor();
      modal.innerHTML = `
        <button type="button" class="btn ghost sm" id="ml-voz-cancelar">${t('Cancelar')}</button>
        <h2 class="mt">${t('Dime qué comiste')}</h2>
        <div class="center mt">
          <button type="button" id="ml-mic" class="ml-mic-btn" aria-label="${t('Grabar')}">${MIC_ICON}</button>
        </div>
        <p class="small muted mt center" id="ml-voz-estado">${t('Toca el micrófono y habla.')}</p>
        <button type="button" class="btn ghost full mt" id="ml-voz-a-texto" hidden>${t('Escribir en su lugar')}</button>`;
      const estado = modal.querySelector('#ml-voz-estado');
      const micBtn = modal.querySelector('#ml-mic');
      const btnATexto = modal.querySelector('#ml-voz-a-texto');
      const rec = new Ctor();
      rec.lang = getIdioma() === 'en' ? 'en-US' : 'es-ES';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      modal.querySelector('#ml-voz-cancelar').addEventListener('click', () => { try { rec.abort(); } catch {} pantallaElegir(); });
      btnATexto.addEventListener('click', () => pantallaTexto());
      // Si el navegador nunca contesta (ni resultado ni error) se queda
      // "Escuchando…" para siempre -- pasa de verdad en Brave, que bloquea
      // por privacidad el servicio de Google detrás de esta API: el
      // micrófono sí arranca (onstart llega), pero la transcripción nunca
      // vuelve. Sin este tope, la única salida era cerrar toda la modal.
      let venceTimeout = null;
      const limpiarTimeout = () => { clearTimeout(venceTimeout); venceTimeout = null; };
      rec.onstart = () => {
        estado.textContent = t('Escuchando…');
        micBtn.classList.add('grabando');
        limpiarTimeout();
        venceTimeout = setTimeout(() => {
          try { rec.abort(); } catch {}
          micBtn.classList.remove('grabando');
          estado.textContent = t('No detectamos audio. Tu navegador puede estar bloqueando el reconocimiento de voz (pasa en Brave) — prueba escribiendo.');
          btnATexto.hidden = false;
        }, 8000);
      };
      rec.onerror = () => {
        limpiarTimeout();
        estado.textContent = t('No se pudo escuchar. Intenta de nuevo o usa texto.');
        micBtn.classList.remove('grabando');
        btnATexto.hidden = false;
      };
      rec.onresult = async (e) => {
        limpiarTimeout();
        const texto = e.results[0][0].transcript;
        pantallaAnalizando();
        try {
          const detectados = await detectarAlimentosTexto(texto);
          fuente = 'voz';
          pantallaConfirmar(detectados);
        } catch (err) {
          toast(err.message || t('No se pudo procesar eso.'));
          pantallaElegir();
        }
      };
      // Arranca solo, apenas se entra a esta pantalla -- tocar "Voz" ya
      // fue el gesto de la usuaria, no hace falta un segundo toque sobre
      // el ícono para empezar a grabar. El ícono sigue sirviendo para
      // reintentar si algo falla (ver rec.onerror arriba).
      const empezar = () => { try { rec.start(); } catch { /* ya estaba escuchando */ } };
      micBtn.addEventListener('click', empezar);
      empezar();
    }

    function pantallaTexto() {
      modal.innerHTML = `
        <h2>${t('¿Qué comiste?')}</h2>
        <textarea id="ml-texto-area" class="auth-input" rows="3" placeholder="${t('Ej: dos huevos, avena y un banano')}" style="margin-top:10px"></textarea>
        <button type="button" class="btn accent full mt" id="ml-texto-enviar">${t('Analizar')}</button>`;
      modal.querySelector('#ml-texto-enviar').addEventListener('click', async () => {
        const texto = modal.querySelector('#ml-texto-area').value.trim();
        if (!texto) return;
        pantallaAnalizando();
        try {
          const detectados = await detectarAlimentosTexto(texto);
          fuente = 'texto';
          pantallaConfirmar(detectados);
        } catch (err) {
          toast(err.message || t('No se pudo procesar eso.'));
          pantallaElegir();
        }
      });
    }

    function pantallaConfirmar(detectados, previewUrl) {
      alimentos = [...detectados];
      render();

      function render() {
        modal.innerHTML = `
          <h2>${t('Esto es lo que detecté')}</h2>
          ${previewUrl ? `<img src="${previewUrl}" alt="" style="width:100%;border-radius:12px;margin-top:10px">` : ''}
          <div class="mt" id="ml-lista"></div>
          <div class="row mt" style="gap:8px">
            <input type="text" id="ml-agregar" class="auth-input" placeholder="${t('+ Agregar alimento')}" style="margin:0">
            <button type="button" class="btn ghost sm" id="ml-agregar-btn">${t('Agregar')}</button>
          </div>
          ${alimentos.length ? `<button type="button" class="btn accent full mt" id="ml-guardar">${t('Guardar comida')}</button>` : `<p class="small muted mt">${t('Agrega al menos un alimento para guardar.')}</p>`}
          <p class="small muted mt center">${t('No es un dato médico exacto — es solo tu registro personal.')}</p>`;

        const lista = modal.querySelector('#ml-lista');
        alimentos.forEach((a, i) => {
          const row = document.createElement('div');
          row.className = 'habit';
          row.innerHTML = `<label>✓ ${esc(a)}</label>`;
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'icon-btn';
          del.style.cssText = 'width:30px;height:30px;font-size:0.9rem';
          del.textContent = '✕';
          del.setAttribute('aria-label', t('Quitar {a}', { a }));
          del.addEventListener('click', () => { alimentos.splice(i, 1); render(); });
          row.appendChild(del);
          lista.appendChild(row);
        });

        modal.querySelector('#ml-agregar-btn').addEventListener('click', agregar);
        modal.querySelector('#ml-agregar').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } });
        function agregar() {
          const input = modal.querySelector('#ml-agregar');
          const val = input.value.trim();
          if (!val) return;
          alimentos.push(val);
          render();
        }

        modal.querySelector('#ml-guardar')?.addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          let fotoUrl = null;
          if (fotoBlob) {
            try {
              fotoUrl = await uploadComidaFoto(fotoBlob, mealId, today());
            } catch {
              // La foto es un plus del diario visual, no un requisito para
              // registrar la comida — si falla la subida, se guarda igual.
            }
          }
          guardarComidaRegistrada(mealId, alimentos, fuente, today(), fotoUrl);
          toast(t('¡Comida registrada! 🌿'));
          closeFn();
          onSaved?.();
        });
      }
    }

    pantallaElegir();
  });
}
