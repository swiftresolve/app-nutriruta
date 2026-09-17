// Modal de "¿Qué comiste realmente?" — foto, voz o texto, siempre con una
// lista editable antes de guardar (nunca se guarda algo que la IA detectó
// sin que la usuaria lo confirme o corrija). No cuenta contra la cuota de
// SuSana ni requiere Premium (ver supabase-client.js / log-meal).
import { openModal, toast, CAMERA_SOLID_ICON, MIC_ICON, TEXTO_ICON } from '../app.js';
import { esc, guardarComidaRegistrada, today } from '../store.js';
import { detectarAlimentosFoto, detectarAlimentosTexto, uploadComidaFoto } from '../supabase-client.js';
import { abrirCamaraEnVivo } from '../camera.js';
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

// Devuelve un CANVAS reescalado (no un dataURL) -- separado así porque de
// ahí se necesitan dos cosas distintas según el llamador: un dataURL para
// mostrar de una vez en un <img> o mandarle el base64 a la IA, y un Blob
// real para subir el archivo. Antes esta función devolvía directo el
// dataURL, y para sacar el Blob se hacía fetch(dataUrl).then(r=>r.blob())
// -- fetch() sobre un dataURL no es confiable en todos los WebView de
// Android: cuando fallaba (sin lanzar ningún error visible), la promesa
// nunca resolvía y la pantalla se quedaba congelada justo después de
// tomar la foto (bug real reportado: "cámara en negro", pero en realidad
// la cámara ya había funcionado -- se congelaba DESPUÉS del disparo).
// canvas.toBlob() es la API nativa del navegador para esto mismo, sin
// pasar por fetch ni por ningún dataURL intermedio.
function reescalar(canvasOrigen, maxDim) {
  const scale = Math.min(1, maxDim / Math.max(canvasOrigen.width, canvasOrigen.height));
  const w = Math.round(canvasOrigen.width * scale);
  const h = Math.round(canvasOrigen.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(canvasOrigen, 0, 0, w, h);
  return canvas;
}
function canvasADataUrl(canvas, calidad) {
  return canvas.toDataURL('image/jpeg', calidad);
}
function canvasABlob(canvas, calidad) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad));
}

// Comprime la foto elegida de galería en el cliente antes de subirla (misma
// idea que el avatar) — no recorta a cuadrado, una comida no siempre lo es.
// Devuelve el Blob de buena calidad para guardar en el diario y, aparte,
// el base64 chico solo para que la IA identifique alimentos.
function toJpegBase64(file, maxDim = MAX_DIM_GUARDAR) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const origen = document.createElement('canvas');
      origen.width = img.width; origen.height = img.height;
      origen.getContext('2d').drawImage(img, 0, 0);
      const canvasGuardar = reescalar(origen, maxDim);
      const dataUrlIA = canvasADataUrl(reescalar(origen, MAX_DIM_IA), 0.82);
      const previewUrl = canvasADataUrl(canvasGuardar, 0.85);
      URL.revokeObjectURL(img.src);
      const blob = await canvasABlob(canvasGuardar, 0.85);
      resolve({ base64: dataUrlIA.split(',')[1], mediaType: 'image/jpeg', previewUrl, blob });
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

// editIndex=null (por defecto) AGREGA una comida más a esa franja del día
// -- pasar el índice de una ya guardada la EDITA en su lugar en vez de
// sumar una nueva (ver "+ Agregar otra" en abrirComidaRegistrada, dashboard.js).
export function openMealLogModal(mealId, mealTitle, onSaved, editIndex = null) {
  openModal((modal, closeFn) => {
    let alimentos = [];
    let fuente = null;
    let fotoBlob = null;
    // La cámara en sí (stream/tracks) vive dentro del closure de
    // abrirCamaraEnVivo (camera.js) -- detenerCamaraCompartida() es la
    // única forma real de apagarla desde aquí.
    let detenerCamaraCompartida = () => {};

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
        console.error(err);
        toast(t('No se pudo procesar la foto.'));
        pantallaElegir();
      }
    });

    // Si el modal se cierra por cualquier vía (✕, tocar fuera, guardar) hay
    // que apagar la cámara siempre — sin esto la lucecita queda prendida.
    const cierreObs = new MutationObserver(() => {
      if (!modal.isConnected) { detenerCamaraCompartida(); fileInput.remove(); cierreObs.disconnect(); }
    });
    cierreObs.observe(document.body, { childList: true });

    function pantallaElegir() {
      detenerCamaraCompartida();
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

    // Cámara en vivo, módulo compartido con planner.js (ver camera.js) --
    // pedido explícito: que sea EXACTAMENTE igual sin importar desde qué
    // pantalla se abra, en vez de dos implementaciones distintas.
    async function pantallaCamara() {
      const { detener } = await abrirCamaraEnVivo({
        modal,
        instruccion: t('Toma una foto de tu comida'),
        onCancelar: () => pantallaElegir(),
        onGaleria: () => fileInput.click(),
        onCapturar: async (cuadro) => {
          const canvasGuardar = reescalar(cuadro, MAX_DIM_GUARDAR);
          const previewUrl = canvasADataUrl(canvasGuardar, 0.85);
          const base64IA = canvasADataUrl(reescalar(cuadro, MAX_DIM_IA), 0.82).split(',')[1];
          try {
            fotoBlob = await canvasABlob(canvasGuardar, 0.85);
            pantallaAnalizando(previewUrl);
            const detectados = await detectarAlimentosFoto(base64IA, 'image/jpeg');
            fuente = 'foto';
            pantallaConfirmar(detectados, previewUrl);
          } catch (err) {
            console.error(err);
            toast(t('No se pudo procesar la foto.'));
            pantallaElegir();
          }
        }
      });
      detenerCamaraCompartida = detener;
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
          console.error(err);
          toast(t('No se pudo procesar eso.'));
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
          console.error(err);
          toast(t('No se pudo procesar eso.'));
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
          guardarComidaRegistrada(mealId, alimentos, fuente, today(), fotoUrl, null, editIndex);
          toast(t('¡Comida registrada! 🌿'));
          closeFn();
          onSaved?.();
        });
      }
    }

    pantallaElegir();
  });
}
