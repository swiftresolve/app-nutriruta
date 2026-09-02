// "Mi Diario" — diario visual de comidas (Fase 3 del roadmap inspirado en
// Fitia, ver memoria proyecto-nutriruta-fitia). Muestra los días recientes
// que tienen al menos una foto registrada (diasConDiario en store.js), con
// una tarjeta de cierre tipo "Mi Ruta — Día X" cuando el día tuvo varias
// comidas registradas, y un botón para compartir una imagen vertical del
// día armada en el cliente (Canvas 2D) — nunca se sube ni se publica sola,
// solo se comparte o descarga lo que la usuaria decide compartir.
import { getState } from '../store.js';
import { diasConDiario } from '../store.js';
import { header, navigate, toast } from '../app.js';
import { MEALS } from '../data/recipes.js';
import { broteStage, broteBadge } from '../ruti.js';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function todayStr() {
  const dt = new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function etiquetaFecha(fecha) {
  const hoy = todayStr();
  if (fecha === hoy) return 'Hoy';
  const ayer = new Date(`${hoy}T00:00:00`);
  ayer.setDate(ayer.getDate() - 1);
  if (fecha === ayer.toISOString().slice(0, 10)) return 'Ayer';
  const dt = new Date(`${fecha}T00:00:00`);
  return `${DIAS_SEMANA[dt.getDay()]} ${dt.getDate()} ${MESES[dt.getMonth()]}`;
}

function mealMeta(mealId) {
  return MEALS.find((m) => m.id === mealId) || { nombre: mealId, emoji: '🍴' };
}

export function renderDiary(container) {
  header(container);

  const back = document.createElement('button');
  back.className = 'link-btn small';
  back.textContent = '← Volver';
  back.addEventListener('click', () => navigate('dashboard'));
  container.appendChild(back);

  const titulo = document.createElement('div');
  titulo.className = 'card center';
  titulo.innerHTML = '<h2>📔 Mi Diario</h2><p class="small muted mt">Las fotos de lo que fuiste registrando — solo para ti.</p>';
  container.appendChild(titulo);

  const dias = diasConDiario(14);

  if (!dias.length) {
    const vacio = document.createElement('div');
    vacio.className = 'card center';
    vacio.innerHTML = '<p class="small muted">Todavía no tienes fotos guardadas. Registra una comida con 📸 desde "Tu ruta de hoy" y aparecerá aquí.</p>';
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
    dia.registros.forEach((r) => {
      const meta = mealMeta(r.mealId);
      const fig = document.createElement('div');
      fig.style.cssText = 'width:31%;min-width:90px';
      fig.innerHTML = `
        <img src="${r.fotoUrl}" alt="${meta.nombre}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;display:block">
        <p class="small muted center mt-xs">${meta.emoji} ${meta.nombre}</p>`;
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
          <span>Hoy también cuidaste de ti 💚</span>
        </div>`;
      card.appendChild(cierre);
    }

    const compartirBtn = document.createElement('button');
    compartirBtn.type = 'button';
    compartirBtn.className = 'btn ghost full mt';
    compartirBtn.textContent = '📤 Compartir este día';
    compartirBtn.addEventListener('click', () => compartirDia(dia, completo, compartirBtn));
    card.appendChild(compartirBtn);

    container.appendChild(card);
  }
}

function cargarImagen(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar una foto.'));
    img.src = url;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Compone una imagen vertical (formato historia) con las fotos del día,
// pensada para compartir en redes — se arma entera en el cliente, nunca
// se sube a ningún servidor propio ni de terceros.
async function crearImagenCompartir(dia, completo) {
  const W = 720, H = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#eafbf1');
  grad.addColorStop(1, '#ffffff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#1f7a4d';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.fillText('Mi Ruta de hoy', W / 2, 100);

  ctx.font = '26px system-ui, sans-serif';
  ctx.fillStyle = '#5a7c68';
  ctx.fillText(etiquetaFecha(dia.fecha), W / 2, 140);

  const fotos = dia.registros.slice(0, 5);
  const cols = Math.min(2, fotos.length) || 1;
  const gap = 16, pad = 40;
  const size = (W - pad * 2 - (cols - 1) * gap) / cols;
  const startY = 190;

  for (let i = 0; i < fotos.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const x = pad + col * (size + gap);
    const y = startY + row * (size + gap);
    try {
      const img = await cargarImagen(fotos[i].fotoUrl);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
      ctx.save();
      roundRect(ctx, x, y, size, size, 20);
      ctx.clip();
      ctx.drawImage(img, sx, sy, side, side, x, y, size, size);
      ctx.restore();
    } catch {
      ctx.fillStyle = '#dcefe3';
      roundRect(ctx, x, y, size, size, 20);
      ctx.fill();
    }
  }

  const rows = Math.ceil(fotos.length / cols);
  let y = startY + rows * (size + gap) + 30;

  if (completo) {
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillStyle = '#1f7a4d';
    ctx.fillText('Hoy también cuidaste de ti 💚', W / 2, Math.min(y, H - 100));
    y += 50;
  }

  ctx.font = '22px system-ui, sans-serif';
  ctx.fillStyle = '#8aa596';
  ctx.fillText('NutriRuta', W / 2, H - 40);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

async function compartirDia(dia, completo, btn) {
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Preparando imagen…';
  try {
    const blob = await crearImagenCompartir(dia, completo);
    if (!blob) throw new Error('No se pudo generar la imagen.');
    const file = new File([blob], `nutriruta-${dia.fecha}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Mi Ruta de hoy' });
      } catch (err) {
        if (err?.name !== 'AbortError') toast('No se pudo compartir.');
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nutriruta-${dia.fecha}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Imagen descargada — ya la puedes compartir 💚');
    }
  } catch (err) {
    toast(err.message || 'No se pudo preparar la imagen.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}
