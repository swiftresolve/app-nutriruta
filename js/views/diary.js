// "Mi Diario" — diario visual de comidas (Fase 3 del roadmap inspirado en
// Fitia, ver memoria proyecto-nutriruta-fitia). Muestra los días recientes
// que tienen al menos una foto registrada (diasConDiario en store.js), con
// una tarjeta de cierre tipo "Mi Ruta — Día X" cuando el día tuvo varias
// comidas registradas, y un botón para compartir una imagen vertical del
// día armada en el cliente (Canvas 2D) — nunca se sube ni se publica sola,
// solo se comparte o descarga lo que la usuaria decide compartir.
import { getState } from '../store.js';
import { diasConDiario } from '../store.js';
import { header, navigate, openModal, SHARE_ICON } from '../app.js';
import { MEALS } from '../data/recipes.js';
import { broteStage, broteBadge } from '../ruti.js';
import { abrirCompartirPlantillas } from '../shareUI.js';
import { t } from '../i18n.js';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function todayStr() {
  const dt = new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function etiquetaFecha(fecha) {
  const hoy = todayStr();
  if (fecha === hoy) return t('Hoy');
  const ayer = new Date(`${hoy}T00:00:00`);
  ayer.setDate(ayer.getDate() - 1);
  if (fecha === ayer.toISOString().slice(0, 10)) return t('Ayer');
  const dt = new Date(`${fecha}T00:00:00`);
  return `${t(DIAS_SEMANA[dt.getDay()])} ${dt.getDate()} ${t(MESES[dt.getMonth()])}`;
}

// Para la imagen de compartir (crearImagenCompartir) -- ahí "Hoy" queda
// redundante justo debajo del título "Mi Ruta de hoy", y además una vez
// compartida la imagen puede verse días después, cuando "Hoy" ya no
// tendría sentido. Siempre la fecha completa, nunca "Hoy"/"Ayer".
function fechaCompletaCompartir(fecha) {
  const dt = new Date(`${fecha}T00:00:00`);
  const dia = t(DIAS_SEMANA[dt.getDay()]).toLowerCase();
  return `${dia}, ${String(dt.getDate()).padStart(2, '0')} ${t(MESES[dt.getMonth()])} ${dt.getFullYear()}`;
}

function mealMeta(mealId) {
  return MEALS.find((m) => m.id === mealId) || { nombre: mealId, emoji: '🍴' };
}

// Visor de foto a pantalla completa (pedido explícito: las miniaturas del
// diario no se podían abrir para verlas bien). Pellizcar para acercar,
// doble toque para alternar zoom -- mismo gesto que cualquier galería
// nativa, y el mismo patrón de pellizco que ya usa la cámara en vivo
// (mealLogModal.js), aplicado aquí sobre translate+scale del <img>.
// `registros` es SOLO el día que se abrió (nunca el total de fotos del
// diario) -- las flechitas navegan entre las comidas de ESE día, pedido
// explícito: la navegación es por día, no por el total de fotos.
function abrirFotoCompleta(registros, indexInicial, metaFn) {
  openModal((modal, closeFn) => {
    // modal todavía no tiene padre en este punto -- openModal llama a este
    // callback ANTES de colgar el modal del backdrop (ver app.js), así que
    // modal.parentElement es null aquí mismo. Se difiere con setTimeout(0)
    // hasta el próximo tick, cuando el backdrop ya existe -- mismo patrón
    // que ya usa abrirHistorialSuSana en assistant.js para su propia clase
    // de pantalla completa (drawer-izq).
    setTimeout(() => modal.parentElement?.classList.add('foto-lightbox'), 0);
    const flechas = registros.length > 1;
    modal.innerHTML = `
      <div class="foto-lightbox-wrap">
        <img src="" alt="" class="foto-lightbox-img">
        ${flechas ? `<button type="button" class="foto-lightbox-flecha izq" aria-label="${t('Foto anterior')}">‹</button>` : ''}
        ${flechas ? `<button type="button" class="foto-lightbox-flecha der" aria-label="${t('Foto siguiente')}">›</button>` : ''}
      </div>`;
    const wrap = modal.querySelector('.foto-lightbox-wrap');
    const img = modal.querySelector('.foto-lightbox-img');
    const flechaIzq = modal.querySelector('.foto-lightbox-flecha.izq');
    const flechaDer = modal.querySelector('.foto-lightbox-flecha.der');

    let indice = indexInicial;
    let scale = 1, panX = 0, panY = 0;
    let distanciaInicial = 0, scaleInicial = 1;
    let panInicial = null;

    function aplicar(conTransicion) {
      img.style.transition = conTransicion ? 'transform 0.2s ease' : 'none';
      img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }

    function mostrar(i) {
      indice = i;
      const r = registros[indice];
      img.src = r.fotoUrl;
      img.alt = metaFn(r);
      scale = 1; panX = 0; panY = 0;
      aplicar(false);
      if (flechas) {
        flechaIzq.disabled = indice === 0;
        flechaDer.disabled = indice === registros.length - 1;
      }
    }
    mostrar(indexInicial);

    flechaIzq?.addEventListener('click', (e) => { e.stopPropagation(); if (indice > 0) mostrar(indice - 1); });
    flechaDer?.addEventListener('click', (e) => { e.stopPropagation(); if (indice < registros.length - 1) mostrar(indice + 1); });

    wrap.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        distanciaInicial = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        scaleInicial = scale;
      } else if (e.touches.length === 1 && scale > 1) {
        panInicial = { x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY };
      }
    }, { passive: true });

    wrap.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && distanciaInicial) {
        e.preventDefault();
        const distanciaActual = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        scale = Math.min(4, Math.max(1, scaleInicial * (distanciaActual / distanciaInicial)));
        aplicar(false);
      } else if (e.touches.length === 1 && panInicial) {
        e.preventDefault();
        panX = e.touches[0].clientX - panInicial.x;
        panY = e.touches[0].clientY - panInicial.y;
        aplicar(false);
      }
    }, { passive: false });

    wrap.addEventListener('touchend', (e) => {
      if (e.touches.length > 0) return;
      distanciaInicial = 0; panInicial = null;
      if (scale <= 1) { scale = 1; panX = 0; panY = 0; aplicar(true); }
    });

    let ultimoTap = 0;
    wrap.addEventListener('touchend', () => {
      const ahora = Date.now();
      if (ahora - ultimoTap < 300) {
        scale = scale > 1 ? 1 : 2.5;
        panX = 0; panY = 0;
        aplicar(true);
      }
      ultimoTap = ahora;
    });
  });
}

export function renderDiary(container) {
  header(container);

  const back = document.createElement('button');
  back.className = 'link-btn small';
  back.textContent = t('← Volver');
  back.addEventListener('click', () => navigate('dashboard'));
  container.appendChild(back);

  const titulo = document.createElement('div');
  titulo.className = 'card center';
  titulo.innerHTML = `<h2>📔 ${t('Mi Diario')}</h2><p class="small muted mt">${t('Las fotos de lo que fuiste registrando — solo para ti.')}</p>`;
  container.appendChild(titulo);

  const dias = diasConDiario(14);

  if (!dias.length) {
    const vacio = document.createElement('div');
    vacio.className = 'card center';
    vacio.innerHTML = `<p class="small muted">${t('Todavía no tienes fotos guardadas. Registra una comida con 📸 desde "Tu ruta de hoy" y aparecerá aquí.')}</p>`;
    container.appendChild(vacio);
    return;
  }

  const { racha } = getState();
  const etapa = broteStage(racha?.actual || 0);

  for (const dia of dias) {
    const card = document.createElement('div');
    card.className = 'card';

    const grid = document.createElement('div');
    grid.className = 'row wrap';
    grid.style.gap = '8px';
    dia.registros.forEach((r, i) => {
      const meta = mealMeta(r.mealId);
      const fig = document.createElement('div');
      fig.style.cssText = 'width:31%;min-width:90px';
      fig.innerHTML = `
        <img src="${r.fotoUrl}" alt="${t(meta.nombre)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;display:block;cursor:pointer">
        <p class="small muted center mt-xs">${meta.emoji} ${t(meta.nombre)}</p>`;
      fig.querySelector('img').addEventListener('click', () => abrirFotoCompleta(dia.registros, i, (reg) => t(mealMeta(reg.mealId).nombre)));
      grid.appendChild(fig);
    });

    const completo = dia.registros.length >= 3;
    card.innerHTML = `<h3>${etiquetaFecha(dia.fecha)}</h3>`;
    card.appendChild(grid);

    if (completo) {
      const cierre = document.createElement('div');
      cierre.className = 'center mt';
      cierre.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:10px">
          ${broteBadge(etapa, { size: 40, premium: false })}
          <span>${t('Hoy también cuidaste de ti 💚')}</span>
        </div>`;
      card.appendChild(cierre);
    }

    const compartirBtn = document.createElement('button');
    compartirBtn.type = 'button';
    compartirBtn.className = 'btn ghost full mt';
    compartirBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px';
    compartirBtn.innerHTML = `${SHARE_ICON}${t('Compartir este día')}`;
    compartirBtn.addEventListener('click', () => {
      const contenidoBase = {
        tipo: 'diario',
        titulo: t('Mi Ruta de hoy'),
        subtitulo: fechaCompletaCompartir(dia.fecha),
        valorGrande: completo ? t('Hoy también cuidaste de ti') : '',
        emoji: '💚'
      };
      // Con una sola foto registrada no hay nada que elegir -- directo al
      // carrusel de plantillas (pedido explícito: compartir debe funcionar
      // desde la primera comida del día, no solo cuando ya están las 5).
      if (dia.registros.length <= 1) {
        abrirCompartirPlantillas({ ...contenidoBase, fotos: dia.registros.map((r) => r.fotoUrl) });
      } else {
        elegirFotosParaCompartir(dia.registros, (fotos) => abrirCompartirPlantillas({ ...contenidoBase, fotos }));
      }
    });
    card.appendChild(compartirBtn);

    container.appendChild(card);
  }
}

// crearImagenCompartir/compartirDia (la única plantilla fija de antes) se
// movieron a shareTemplates.js/shareUI.js -- ahora Mi Diario es solo uno
// de los 4 tipos de contenido que ese motor compartido sabe dibujar (ver
// abrirCompartirPlantillas más arriba), con varias plantillas para elegir
// en vez de una sola imagen fija.

// Paso previo al carrusel de plantillas cuando hay más de una foto ese
// día: todas empiezan preseleccionadas (lo más común es compartir el día
// completo) y se puede destocar la que no se quiera incluir -- pedido
// explícito: la usuaria elige cuáles fotos entran al collage, no todas
// por obligación.
function elegirFotosParaCompartir(registros, onListo) {
  openModal((modal, closeFn) => {
    const seleccionadas = new Set(registros.map((r) => r.fotoUrl));
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <h2 class="center">${t('¿Qué fotos incluyes?')}</h2>
      <p class="small muted center mt">${t('Toca una para quitarla del collage.')}</p>
      <div class="foto-elegir-grid mt" id="foto-elegir-grid"></div>
      <button type="button" class="btn accent full mt" id="foto-elegir-continuar">${t('Continuar')}</button>`;
    modal.appendChild(wrap);

    const grid = wrap.querySelector('#foto-elegir-grid');
    const continuarBtn = wrap.querySelector('#foto-elegir-continuar');
    function refrescarBoton() {
      continuarBtn.disabled = seleccionadas.size === 0;
      continuarBtn.style.opacity = seleccionadas.size === 0 ? '0.5' : '1';
    }
    registros.forEach((r) => {
      const meta = mealMeta(r.mealId);
      const item = document.createElement('div');
      item.className = 'foto-elegir-item selected';
      item.innerHTML = `<img src="${r.fotoUrl}" alt="${t(meta.nombre)}"><span class="foto-elegir-check">✓</span>`;
      item.addEventListener('click', () => {
        if (seleccionadas.has(r.fotoUrl)) { seleccionadas.delete(r.fotoUrl); item.classList.remove('selected'); }
        else { seleccionadas.add(r.fotoUrl); item.classList.add('selected'); }
        refrescarBoton();
      });
      grid.appendChild(item);
    });
    refrescarBoton();

    continuarBtn.addEventListener('click', () => {
      if (!seleccionadas.size) return;
      const orden = registros.map((r) => r.fotoUrl).filter((u) => seleccionadas.has(u));
      closeFn();
      onListo(orden);
    });
  });
}
