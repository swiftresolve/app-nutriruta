// Modal de "¿Qué comiste realmente?" — foto, voz o texto, siempre con una
// lista editable antes de guardar (nunca se guarda algo que la IA detectó
// sin que la usuaria lo confirme o corrija). No cuenta contra la cuota de
// SuSana ni requiere Premium (ver supabase-client.js / log-meal).
import { openModal, toast, CAMERA_SOLID_ICON, MIC_ICON, TEXTO_ICON } from '../app.js';
import { esc, guardarComidaRegistrada, today } from '../store.js';
import { detectarAlimentosFoto, detectarAlimentosTexto, uploadComidaFoto } from '../supabase-client.js';

// Comprime y redimensiona la foto en el cliente antes de subirla (misma
// idea que el avatar) — no recorta a cuadrado, una comida no siempre lo es.
// Devuelve tanto el base64 (para que la IA identifique alimentos) como el
// Blob (para guardarla de verdad en el diario visual).
function toJpegBase64(file, maxDim = 1000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      URL.revokeObjectURL(img.src);
      canvas.toBlob((blob) => {
        resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg', previewUrl: dataUrl, blob });
      }, 'image/jpeg', 0.82);
    };
    img.onerror = () => reject(new Error('Imagen inválida.'));
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
        toast(err.message || 'No se pudo procesar la foto.');
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
        <h2>¿Qué comiste en ${esc(mealTitle)}?</h2>
        <p class="small muted mt">Regístralo con foto, voz o texto — puedes corregir la lista antes de guardar.</p>
        <div class="ml-opciones mt">
          <button type="button" class="ml-opcion" id="ml-foto" aria-label="Foto"><span class="ml-opcion-circle">${CAMERA_SOLID_ICON}</span></button>
          ${speechRecognitionCtor() ? `<button type="button" class="ml-opcion" id="ml-voz" aria-label="Voz"><span class="ml-opcion-circle">${MIC_ICON}</span></button>` : ''}
          <button type="button" class="ml-opcion" id="ml-texto" aria-label="Texto"><span class="ml-opcion-circle">${TEXTO_ICON}</span></button>
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
        <div class="camera-top"><button type="button" class="camera-cancelar" id="ml-cam-cancelar">Cancelar</button></div>
        <p class="camera-instruccion">Toma una foto de tu comida</p>
        <div class="camera-wrap">
          <video id="ml-video" autoplay playsinline muted></video>
          <div class="camera-frame"></div>
        </div>
        <div class="camera-controls">
          <button type="button" class="camera-icon-btn" id="ml-cam-galeria" aria-label="Elegir de la galería">🖼️</button>
          <button type="button" id="ml-shutter" class="camera-shutter" aria-label="Tomar foto"></button>
          <span class="camera-icon-btn" style="visibility:hidden" aria-hidden="true"></span>
        </div>`;

      modal.querySelector('#ml-cam-cancelar').addEventListener('click', () => { detenerCamara(); salirFullscreen(); pantallaElegir(); });
      modal.querySelector('#ml-cam-galeria').addEventListener('click', () => { detenerCamara(); salirFullscreen(); fileInput.click(); });

      const video = modal.querySelector('#ml-video');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        video.srcObject = stream;
      } catch {
        salirFullscreen();
        toast('No pudimos abrir la cámara. Elige una foto de tu galería.');
        fileInput.click();
        return;
      }

      modal.querySelector('#ml-shutter').addEventListener('click', () => {
        // Recorte cuadrado centrado del frame actual del video, coherente
        // con el encuadre que se le muestra a la usuaria.
        const w = video.videoWidth, h = video.videoHeight;
        const side = Math.min(w, h);
        const canvas = document.createElement('canvas');
        canvas.width = side; canvas.height = side;
        canvas.getContext('2d').drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, side, side);
        detenerCamara();
        salirFullscreen();
        canvas.toBlob(async (blob) => {
          const previewUrl = canvas.toDataURL('image/jpeg', 0.85);
          fotoBlob = blob;
          pantallaAnalizando(previewUrl);
          try {
            const detectados = await detectarAlimentosFoto(previewUrl.split(',')[1], 'image/jpeg');
            fuente = 'foto';
            pantallaConfirmar(detectados, previewUrl);
          } catch (err) {
            toast(err.message || 'No se pudo procesar la foto.');
            pantallaElegir();
          }
        }, 'image/jpeg', 0.85);
      });
    }

    function pantallaAnalizando(previewUrl) {
      modal.innerHTML = `
        <h2>Analizando…</h2>
        ${previewUrl ? `<img src="${previewUrl}" alt="" style="width:100%;border-radius:12px;margin-top:10px">` : ''}
        <p class="small muted mt center">Un momento, estamos identificando lo que comiste.</p>`;
    }

    function pantallaVoz() {
      const Ctor = speechRecognitionCtor();
      modal.innerHTML = `
        <h2>Dime qué comiste</h2>
        <div class="center mt">
          <button type="button" id="ml-mic" class="ml-mic-btn" aria-label="Grabar">${MIC_ICON}</button>
        </div>
        <p class="small muted mt center" id="ml-voz-estado">Toca el micrófono y habla.</p>`;
      const estado = modal.querySelector('#ml-voz-estado');
      const micBtn = modal.querySelector('#ml-mic');
      const rec = new Ctor();
      rec.lang = 'es-ES';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      // Titileo lento mientras "graba" -- señal visual de que sí está
      // escuchando, no solo el texto de estado de arriba.
      rec.onstart = () => { estado.textContent = 'Escuchando…'; micBtn.classList.add('grabando'); };
      rec.onerror = () => { estado.textContent = 'No se pudo escuchar. Intenta de nuevo o usa texto.'; micBtn.classList.remove('grabando'); };
      rec.onresult = async (e) => {
        const texto = e.results[0][0].transcript;
        pantallaAnalizando();
        try {
          const detectados = await detectarAlimentosTexto(texto);
          fuente = 'voz';
          pantallaConfirmar(detectados);
        } catch (err) {
          toast(err.message || 'No se pudo procesar eso.');
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
        <h2>¿Qué comiste?</h2>
        <textarea id="ml-texto-area" class="auth-input" rows="3" placeholder="Ej: dos huevos, avena y un banano" style="margin-top:10px"></textarea>
        <button type="button" class="btn accent full mt" id="ml-texto-enviar">Analizar</button>`;
      modal.querySelector('#ml-texto-enviar').addEventListener('click', async () => {
        const texto = modal.querySelector('#ml-texto-area').value.trim();
        if (!texto) return;
        pantallaAnalizando();
        try {
          const detectados = await detectarAlimentosTexto(texto);
          fuente = 'texto';
          pantallaConfirmar(detectados);
        } catch (err) {
          toast(err.message || 'No se pudo procesar eso.');
          pantallaElegir();
        }
      });
    }

    function pantallaConfirmar(detectados, previewUrl) {
      alimentos = [...detectados];
      render();

      function render() {
        modal.innerHTML = `
          <h2>Esto es lo que detecté</h2>
          ${previewUrl ? `<img src="${previewUrl}" alt="" style="width:100%;border-radius:12px;margin-top:10px">` : ''}
          <div class="mt" id="ml-lista"></div>
          <div class="row mt" style="gap:8px">
            <input type="text" id="ml-agregar" class="auth-input" placeholder="+ Agregar alimento" style="margin:0">
            <button type="button" class="btn ghost sm" id="ml-agregar-btn">Agregar</button>
          </div>
          ${alimentos.length ? '<button type="button" class="btn accent full mt" id="ml-guardar">Guardar comida</button>' : '<p class="small muted mt">Agrega al menos un alimento para guardar.</p>'}
          <p class="small muted mt center">No es un dato médico exacto — es solo tu registro personal.</p>`;

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
          del.setAttribute('aria-label', `Quitar ${a}`);
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
          toast('¡Comida registrada! 🌿');
          closeFn();
          onSaved?.();
        });
      }
    }

    pantallaElegir();
  });
}
