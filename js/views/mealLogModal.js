// Modal de "¿Qué comiste realmente?" — foto, voz, texto con IA o manual,
// siempre con una lista editable antes de guardar (nunca se guarda algo
// que la IA detectó sin que la usuaria lo confirme o corrija). EN
// EVALUACIÓN (2026-09-20): foto/voz/texto-con-IA pasan a requerir Premium
// (cada llamada a log-meal tiene costo real) -- "Registrar manualmente"
// se mantiene gratis para siempre, sin ninguna llamada a IA, para que el
// hábito de registrar nunca dependa de pagar.
import { openModal, toast, navigate, CAMERA_SOLID_ICON, MIC_ICON, TEXTO_ICON, PENCIL_ICON } from '../app.js';
import { esc, guardarComidaRegistrada, comidasDelDia, today, isPremium } from '../store.js';
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
    // Si esta edición no vuelve a tomar/elegir una foto nueva (ej. corrige
    // por voz o texto), la foto que ya existía en ese registro se conserva
    // tal cual -- antes, editar por cualquier vía que no fuera foto la
    // perdía en silencio, sin avisar (bug real: guardarComidaRegistrada
    // solo escribe fotoUrl cuando llega una nueva, así que editar por
    // texto/voz guardaba el registro SIN foto, pisando la que ya había).
    const fotoUrlExistente = editIndex != null ? (comidasDelDia(mealId)[editIndex]?.fotoUrl || null) : null;

    // Si el plan Premium venció A MITAD de esta sesión (ej. la modal ya
    // estaba abierta cuando expiró), el servidor rechaza con este código
    // aunque el candado del cliente no haya alcanzado a bloquear el botón
    // -- ahí no tiene sentido el toast genérico de "no se pudo procesar",
    // se manda directo a Planes con el motivo real.
    function manejarErrorIA(err, mensaje = t('No se pudo procesar eso.')) {
      console.error(err);
      if (err?.code === 'premium_requerido') {
        closeFn();
        toast(t('Tu plan Premium ya no está activo.'));
        navigate('plans');
        return;
      }
      toast(mensaje);
      pantallaElegir();
    }
    // Mismo criterio que la foto -- si esta edición no vuelve a detectar un
    // nombre de platillo (ej. la IA no reconoce uno en el nuevo texto/voz),
    // se conserva el que ya tenía en vez de borrarlo en silencio.
    const nombreExistente = editIndex != null ? (comidasDelDia(mealId)[editIndex]?.nombre || null) : null;
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
        manejarErrorIA(err, t('No se pudo procesar la foto.'));
      }
    });

    // Si el modal se cierra por cualquier vía (✕, tocar fuera, guardar) hay
    // que apagar la cámara siempre — sin esto la lucecita queda prendida.
    const cierreObs = new MutationObserver(() => {
      if (!modal.isConnected) { detenerCamaraCompartida(); fileInput.remove(); cierreObs.disconnect(); }
    });
    cierreObs.observe(document.body, { childList: true });

    // PREVIEW / en evaluación con la usuaria (2026-09-20): el reconocimiento
    // por IA (foto/voz/texto libre) pasa a ser un beneficio Premium -- cada
    // llamada a log-meal tiene un costo real, y regalarlo sin límite a
    // cuentas gratis no tiene ningún ingreso detrás que lo cubra. El plan
    // gratis conserva "Registrar manualmente": arma la lista sin IA, cero
    // costo, para que el hábito de registrar nunca se corte por no pagar.
    const premium = isPremium();

    function pantallaElegir() {
      detenerCamaraCompartida();
      modal.innerHTML = `
        <h2>${t('¿Qué comiste en {mealTitle}?', { mealTitle: esc(mealTitle) })}</h2>
        <p class="small muted mt">${premium
          ? t('Regístralo con foto, voz o texto — puedes corregir la lista antes de guardar.')
          : t('Regístralo escribiendo la lista, o hazte Premium para que la IA la arme por ti con foto o voz.')}</p>
        <div class="ml-opciones mt">
          <button type="button" class="ml-opcion${premium ? '' : ' locked'}" id="ml-foto" aria-label="${t('Foto')}"><span class="ml-opcion-circle">${CAMERA_SOLID_ICON}${premium ? '' : '<span class="ml-opcion-candado">🔒</span>'}</span><span class="ml-opcion-label">${t('Foto')}</span></button>
          ${speechRecognitionCtor() ? `<button type="button" class="ml-opcion${premium ? '' : ' locked'}" id="ml-voz" aria-label="${t('Voz')}"><span class="ml-opcion-circle">${MIC_ICON}${premium ? '' : '<span class="ml-opcion-candado">🔒</span>'}</span><span class="ml-opcion-label">${t('Voz')}</span></button>` : ''}
          <button type="button" class="ml-opcion${premium ? '' : ' locked'}" id="ml-texto" aria-label="${t('Texto con IA')}"><span class="ml-opcion-circle">${TEXTO_ICON}${premium ? '' : '<span class="ml-opcion-candado">🔒</span>'}</span><span class="ml-opcion-label">${t('Texto IA')}</span></button>
          <button type="button" class="ml-opcion" id="ml-manual" aria-label="${t('Escribir manualmente')}"><span class="ml-opcion-circle manual">${PENCIL_ICON}</span><span class="ml-opcion-label">${t('Manual')}</span></button>
        </div>`;

      const abrirOMostrarUpsell = (abrir) => premium ? abrir() : mostrarUpsellIA();
      modal.querySelector('#ml-foto').addEventListener('click', () => abrirOMostrarUpsell(pantallaCamara));
      modal.querySelector('#ml-voz')?.addEventListener('click', () => abrirOMostrarUpsell(pantallaVoz));
      modal.querySelector('#ml-texto').addEventListener('click', () => abrirOMostrarUpsell(pantallaTexto));
      modal.querySelector('#ml-manual').addEventListener('click', () => pantallaManual());
    }

    // Mismo patrón de upsell que ya usa el Recetario/Lista de compras
    // (planner.js) -- explica el beneficio, nunca solo "esto es Premium"
    // a secas, y manda a Planes al confirmar.
    function mostrarUpsellIA() {
      openModal((modalUpsell, closeUpsell) => {
        modalUpsell.insertAdjacentHTML('beforeend', `
          <h2 class="center">🔒 ${t('Reconocimiento con IA')}</h2>
          <p class="mt center">${t('Toma una foto o dilo en voz alta y la IA arma la lista de alimentos por ti -- parte del plan Premium.')}</p>
          <button type="button" class="btn accent full mt" id="ml-upsell-ver">${t('Ver planes Premium')}</button>`);
        // Cierra ESTE modal de upsell y también el de "¿Qué comiste?" de
        // atrás -- navigate() solo reemplaza #app, los modales viven en
        // document.body aparte y se quedarían flotando sobre Planes si no
        // se cierran explícitamente los dos.
        modalUpsell.querySelector('#ml-upsell-ver').addEventListener('click', () => { closeUpsell(); closeFn(); navigate('plans'); });
      });
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
            manejarErrorIA(err, t('No se pudo procesar la foto.'));
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
      let resuelto = false;
      const limpiarTimeout = () => { clearTimeout(venceTimeout); venceTimeout = null; };
      const fallo = (mensaje) => {
        if (resuelto) return;
        resuelto = true;
        limpiarTimeout();
        micBtn.classList.remove('grabando');
        estado.textContent = mensaje;
        btnATexto.hidden = false;
      };
      rec.onstart = () => {
        estado.textContent = t('Escuchando…');
        micBtn.classList.add('grabando');
        limpiarTimeout();
        venceTimeout = setTimeout(() => {
          try { rec.abort(); } catch {}
          fallo(t('No detectamos audio. Tu navegador puede estar bloqueando el reconocimiento de voz (pasa en Brave) — prueba escribiendo.'));
        }, 8000);
      };
      rec.onerror = () => {
        fallo(t('No se pudo escuchar. Intenta de nuevo o usa texto.'));
      };
      // En algunos Android el botón de voz aparece -- la API existe --
      // pero no hay ningún servicio real detrás: nunca llega onresult ni
      // onerror, solo onend apenas termina de "escuchar" en silencio. Sin
      // este handler, la pantalla se quedaba en "Escuchando…" para siempre
      // en esos casos -- el timeout de 8s de arriba es el respaldo si ni
      // onend llega.
      rec.onend = () => {
        fallo(t('No pudimos escucharte. Este teléfono puede no tener disponible el reconocimiento de voz — prueba escribiendo.'));
      };
      rec.onresult = async (e) => {
        resuelto = true;
        limpiarTimeout();
        const texto = e.results[0][0].transcript;
        pantallaAnalizando();
        try {
          const detectados = await detectarAlimentosTexto(texto);
          fuente = 'voz';
          pantallaConfirmar(detectados);
        } catch (err) {
          manejarErrorIA(err);
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
          manejarErrorIA(err);
        }
      });
    }

    // Registro 100% manual -- sin ninguna llamada a log-meal/IA, cero
    // costo. Cae directo en la misma lista editable de pantallaConfirmar,
    // vacía en vez de con detecciones, para reusar exactamente el mismo
    // editor de alimentos (agregar/quitar) en vez de duplicarlo.
    function pantallaManual() {
      fuente = 'manual';
      pantallaConfirmar({ nombre: null, alimentos: [] });
    }

    // Cada alimento con la primera letra en mayúscula y el resto en
    // minúscula, sin importar cómo lo devolvió la IA (foto/voz/texto) o
    // cómo lo haya escrito la usuaria a mano -- consistente con el mismo
    // criterio ya usado para las exclusiones de texto libre del quiz.
    function capitalizar(texto) {
      return texto ? texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase() : texto;
    }

    // Nombre del platillo (ej. "Bandeja paisa") que la IA reconoce cuando
    // aplica -- ver invokeLogMeal en supabase-client.js. Sin esto, la
    // tarjeta de "lo que registraste" (abrirComidaRegistrada, dashboard.js)
    // usaba la lista de ingredientes pegada como si fuera el título.
    let nombrePlatillo = null;

    function pantallaConfirmar({ nombre, alimentos: detectados }, previewUrl) {
      nombrePlatillo = nombre || nombreExistente;
      alimentos = detectados.map(capitalizar);
      render();

      function render() {
        modal.innerHTML = `
          <h2>${fuente === 'manual' ? t('¿Qué comiste?') : t('Esto es lo que detecté')}</h2>
          ${previewUrl ? `<img src="${previewUrl}" alt="" style="width:100%;border-radius:12px;margin-top:10px">` : ''}
          <label class="small muted mt" for="ml-nombre-platillo">${t('Nombre del platillo (opcional)')}</label>
          <input type="text" id="ml-nombre-platillo" class="auth-input" placeholder="${t('Ej: Bandeja paisa')}" value="${esc(nombrePlatillo || '')}" style="margin-top:4px">
          <div class="mt" id="ml-lista"></div>
          <div class="row mt" style="gap:8px">
            <input type="text" id="ml-agregar" class="auth-input" placeholder="${t('+ Agregar alimento')}" style="margin:0">
            <button type="button" class="btn ghost sm" id="ml-agregar-btn">${t('Agregar')}</button>
          </div>
          ${alimentos.length ? `<button type="button" class="btn accent full mt" id="ml-guardar">${t('Guardar comida')}</button>` : `<p class="small muted mt">${t('Agrega al menos un alimento para guardar.')}</p>`}
          <p class="small muted mt center">${t('No es un dato médico exacto — es solo tu registro personal.')}</p>`;

        // Se sincroniza en cada tecla (no solo al guardar) porque agregar/
        // quitar un alimento vuelve a llamar render() -- sin esto, lo que
        // la usuaria ya había escrito acá se perdía en el primer +/✕ que
        // tocara después.
        modal.querySelector('#ml-nombre-platillo').addEventListener('input', (e) => {
          nombrePlatillo = e.target.value.trim() || null;
        });

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
          const val = capitalizar(input.value.trim());
          if (!val) return;
          alimentos.push(val);
          render();
        }

        modal.querySelector('#ml-guardar')?.addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          let fotoUrl = fotoUrlExistente;
          if (fotoBlob) {
            try {
              fotoUrl = await uploadComidaFoto(fotoBlob, mealId, today());
            } catch {
              // La foto es un plus del diario visual, no un requisito para
              // registrar la comida — si falla la subida, se guarda igual
              // (conservando la que ya había, si esto era una edición).
            }
          }
          guardarComidaRegistrada(mealId, alimentos, fuente, today(), fotoUrl, nombrePlatillo, editIndex);
          toast(t('¡Comida registrada! 🌿'));
          closeFn();
          onSaved?.();
        });
      }
    }

    pantallaElegir();
  });
}
