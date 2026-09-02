// Modal de "¿Qué comiste realmente?" — foto, voz o texto, siempre con una
// lista editable antes de guardar (nunca se guarda algo que la IA detectó
// sin que la usuaria lo confirme o corrija). No cuenta contra la cuota de
// Susana ni requiere Premium (ver supabase-client.js / log-meal).
import { openModal, toast } from '../app.js';
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

    function pantallaElegir() {
      modal.innerHTML = `
        <h2>¿Qué comiste en ${esc(mealTitle)}?</h2>
        <p class="small muted mt">Regístralo con foto, voz o texto — puedes corregir la lista antes de guardar.</p>
        <div class="row wrap mt" style="gap:10px;justify-content:center">
          <button type="button" class="btn ghost" id="ml-foto" style="flex-direction:column;height:80px;width:90px">📸<span class="small mt">Foto</span></button>
          ${speechRecognitionCtor() ? '<button type="button" class="btn ghost" id="ml-voz" style="flex-direction:column;height:80px;width:90px">🎤<span class="small mt">Voz</span></button>' : ''}
          <button type="button" class="btn ghost" id="ml-texto" style="flex-direction:column;height:80px;width:90px">⌨️<span class="small mt">Texto</span></button>
        </div>
        <input type="file" id="ml-file" accept="image/*" capture="environment" hidden>`;

      const fileInput = modal.querySelector('#ml-file');
      modal.querySelector('#ml-foto').addEventListener('click', () => fileInput.click());
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

      modal.querySelector('#ml-voz')?.addEventListener('click', () => pantallaVoz());
      modal.querySelector('#ml-texto').addEventListener('click', () => pantallaTexto());
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
          <button type="button" id="ml-mic" class="btn accent" style="width:80px;height:80px;border-radius:50%;font-size:1.8rem">🎤</button>
        </div>
        <p class="small muted mt center" id="ml-voz-estado">Toca el micrófono y habla.</p>`;
      const estado = modal.querySelector('#ml-voz-estado');
      const rec = new Ctor();
      rec.lang = 'es-ES';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => { estado.textContent = 'Escuchando…'; };
      rec.onerror = () => { estado.textContent = 'No se pudo escuchar. Intenta de nuevo o usa texto.'; };
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
      modal.querySelector('#ml-mic').addEventListener('click', () => rec.start());
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
