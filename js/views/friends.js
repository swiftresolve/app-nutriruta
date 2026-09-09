// Amigos: agregar por username (buscado dentro de la app) o por link
// compartido fuera de ella (?amigo=<username>, ver app.js) -- un solo
// identificador para las dos formas, nunca se mezcla con referido_codigo
// (que sigue siendo solo del bono de Premium). Requiere aceptación mutua
// (pedido explícito de la usuaria): una solicitud no muestra nada del
// otro lado hasta que la acepta. Ver migración amigos_fundacion para las
// funciones del servidor (RLS + SECURITY DEFINER) detrás de cada llamada.
import { esc } from '../store.js';
import { header, openModal, toast, TRASH_ICON, SHARE_ICON } from '../app.js';
import {
  miUsername, setUsername, buscarAmigoPorUsername, solicitarAmistad,
  responderSolicitudAmistad, eliminarAmistad, misSolicitudesPendientes, misAmigos
} from '../supabase-client.js';
import { t } from '../i18n.js';

// Mensajes de error crudos que llegan del servidor (ver RPCs en la
// migración) traducidos a algo legible -- nunca se le muestra a la
// usuaria un mensaje de Postgres sin traducir.
function textoError(codigo) {
  const MAPA = {
    username_invalido: t('Usa entre 3 y 20 letras/números/guion bajo, sin espacios.'),
    username_tomado: t('Ese nombre de usuario ya está en uso.'),
    no_puedes_agregarte: t('No puedes agregarte a ti misma.'),
    ya_son_amigos: t('Ya son amigas.'),
    solicitud_pendiente: t('Ya le enviaste una solicitud -- falta que la acepte.'),
    solicitud_no_encontrada: t('Esa solicitud ya no está disponible.')
  };
  return MAPA[codigo] || t('Algo no funcionó. Intenta de nuevo.');
}

export function renderFriends(container) {
  header(container);
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="card center"><p class="muted">${t('Cargando…')}</p></div>`;
  container.appendChild(wrap);

  miUsername().then((username) => pintar(wrap, username)).catch(() => {
    wrap.innerHTML = `<div class="card center"><p class="muted">${t('No pudimos cargar esta pantalla. Intenta de nuevo más tarde.')}</p></div>`;
  });
}

function pintar(wrap, username) {
  wrap.innerHTML = '';

  const titulo = document.createElement('div');
  titulo.className = 'center mt mb';
  titulo.innerHTML = `<h2>👥 ${t('Amigos')}</h2><p class="small muted">${t('Agrégalas para ver su racha y compartir la Ruta.')}</p>`;
  wrap.appendChild(titulo);

  if (!username) {
    wrap.appendChild(tarjetaElegirUsername((nuevoUsername) => pintar(wrap, nuevoUsername)));
    return;
  }

  wrap.appendChild(tarjetaCompartir(username));
  wrap.appendChild(tarjetaBuscar(() => refrescar()));

  const solicitudesCard = document.createElement('div');
  solicitudesCard.className = 'card mt';
  solicitudesCard.hidden = true;
  wrap.appendChild(solicitudesCard);

  const amigosCard = document.createElement('div');
  amigosCard.className = 'card mt';
  wrap.appendChild(amigosCard);

  function refrescar() {
    Promise.all([misSolicitudesPendientes(), misAmigos()]).then(([solicitudes, amigos]) => {
      pintarSolicitudes(solicitudesCard, solicitudes, refrescar);
      pintarAmigos(amigosCard, amigos, refrescar);
    });
  }
  refrescar();
}

function tarjetaElegirUsername(onListo) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <h3>${t('Elige tu nombre de usuario')}</h3>
    <p class="small muted mt">${t('Así te van a poder agregar como amiga -- solo minúsculas, números y guion bajo.')}</p>
    <div class="row mt" style="gap:8px">
      <input type="text" id="fr-username" class="auth-input" placeholder="ej. vicky_lc" maxlength="20" style="margin:0">
      <button type="button" class="btn sm" id="fr-username-guardar">${t('Guardar')}</button>
    </div>
    <p class="small" id="fr-username-error" style="color:var(--danger,#e05555);min-height:1.2em"></p>`;
  const input = card.querySelector('#fr-username');
  const err = card.querySelector('#fr-username-error');
  card.querySelector('#fr-username-guardar').addEventListener('click', async () => {
    const val = input.value.trim();
    if (!val) return;
    err.textContent = '';
    try {
      await setUsername(val);
      toast(t('¡Listo! Ya pueden agregarte 🌿'));
      onListo(val.toLowerCase());
    } catch (e) {
      err.textContent = textoError(e.message);
    }
  });
  return card;
}

function tarjetaCompartir(username) {
  const link = `https://nutriruta.app/?amigo=${encodeURIComponent(username)}`;
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <p class="small muted">${t('Tu usuario')}</p>
    <p style="font-weight:700">@${esc(username)}</p>
    <button type="button" class="btn accent full mt row" id="fr-compartir" style="gap:8px;justify-content:center;align-items:center">${SHARE_ICON.replace('var(--primary-dark)', '#fff')}${t('Compartir mi link')}</button>`;
  card.querySelector('#fr-compartir').addEventListener('click', async () => {
    const texto = t('Agrégame en NutriRuta 🌿: {link}', { link });
    if (navigator.share) {
      try { await navigator.share({ title: t('Agrégame en NutriRuta'), text: texto }); } catch { /* canceló, no es un error */ }
      return;
    }
    try { await navigator.clipboard.writeText(texto); toast(t('Enlace copiado 📋')); }
    catch { toast(t('No se pudo copiar automáticamente.')); }
  });
  return card;
}

function tarjetaBuscar(onAgregada) {
  const card = document.createElement('div');
  card.className = 'card mt';
  card.innerHTML = `
    <h3>${t('Agregar por usuario')}</h3>
    <div class="row mt" style="gap:8px">
      <input type="text" id="fr-buscar" class="auth-input" placeholder="@usuario" style="margin:0">
      <button type="button" class="btn ghost sm" id="fr-buscar-btn">${t('Buscar')}</button>
    </div>
    <div class="mt" id="fr-resultado"></div>`;
  const input = card.querySelector('#fr-buscar');
  const resultado = card.querySelector('#fr-resultado');
  async function buscar() {
    const val = input.value.trim().replace(/^@/, '');
    if (!val) return;
    resultado.innerHTML = `<p class="small muted">${t('Buscando…')}</p>`;
    try {
      const encontrado = await buscarAmigoPorUsername(val);
      if (!encontrado) {
        resultado.innerHTML = `<p class="small muted">${t('No encontramos a nadie con ese usuario.')}</p>`;
        return;
      }
      resultado.innerHTML = '';
      const fila = document.createElement('div');
      fila.className = 'habit';
      fila.innerHTML = `<label style="flex:1">${esc(encontrado.nombre || encontrado.username)} <span class="small muted">@${esc(encontrado.username)}</span></label>`;
      const btn = document.createElement('button');
      btn.className = 'btn sm';
      btn.textContent = t('Agregar');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await solicitarAmistad(encontrado.id);
          toast(t('¡Solicitud enviada! 🌿'));
          resultado.innerHTML = '';
          input.value = '';
          onAgregada();
        } catch (e) {
          toast(textoError(e.message));
          btn.disabled = false;
        }
      });
      fila.appendChild(btn);
      resultado.appendChild(fila);
    } catch {
      resultado.innerHTML = `<p class="small muted">${t('No se pudo buscar. Intenta de nuevo.')}</p>`;
    }
  }
  card.querySelector('#fr-buscar-btn').addEventListener('click', buscar);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });
  return card;
}

function pintarSolicitudes(card, solicitudes, onCambio) {
  card.hidden = !solicitudes.length;
  if (!solicitudes.length) return;
  card.innerHTML = `<h3>${t('Solicitudes nuevas')}</h3>`;
  solicitudes.forEach((s) => {
    const fila = document.createElement('div');
    fila.className = 'habit';
    fila.innerHTML = `<label style="flex:1">${esc(s.de_nombre || s.de_username)} <span class="small muted">@${esc(s.de_username)}</span></label>`;
    const acciones = document.createElement('div');
    acciones.className = 'row';
    acciones.style.gap = '6px';
    const rechazar = document.createElement('button');
    rechazar.className = 'btn ghost sm';
    rechazar.textContent = t('Rechazar');
    rechazar.addEventListener('click', async () => {
      try { await responderSolicitudAmistad(s.id, false); onCambio(); }
      catch { toast(t('Algo no funcionó. Intenta de nuevo.')); }
    });
    const aceptar = document.createElement('button');
    aceptar.className = 'btn accent sm';
    aceptar.textContent = t('Aceptar');
    aceptar.addEventListener('click', async () => {
      try { await responderSolicitudAmistad(s.id, true); toast(t('¡Ahora son amigas! 🌿')); onCambio(); }
      catch { toast(t('Algo no funcionó. Intenta de nuevo.')); }
    });
    acciones.appendChild(rechazar);
    acciones.appendChild(aceptar);
    fila.appendChild(acciones);
    card.appendChild(fila);
  });
}

function pintarAmigos(card, amigos, onCambio) {
  card.innerHTML = `<h3>${t('Mis amigas')} ${amigos.length ? `<span class="small muted">(${amigos.length})</span>` : ''}</h3>`;
  if (!amigos.length) {
    card.innerHTML += `<p class="small muted mt">${t('Todavía no tienes amigas agregadas -- comparte tu link o busca a alguien arriba.')}</p>`;
    return;
  }
  amigos.forEach((a) => {
    const fila = document.createElement('div');
    fila.className = 'habit';
    fila.innerHTML = `
      <label style="flex:1">${esc(a.nombre || a.username)} <span class="small muted">@${esc(a.username)}</span></label>
      <span class="small" style="white-space:nowrap">🔥 ${a.racha_actual}</span>`;
    const btn = document.createElement('button');
    btn.className = 'icon-btn plain';
    btn.setAttribute('aria-label', t('Eliminar amistad'));
    btn.innerHTML = TRASH_ICON;
    btn.style.marginLeft = '6px';
    btn.addEventListener('click', () => {
      openModal((modal, closeFn) => {
        modal.insertAdjacentHTML('beforeend', `
          <h2>${t('¿Eliminar a {nombre} de tus amigas?', { nombre: a.nombre || a.username })}</h2>
          <p class="mt small muted">${t('Puedes volver a agregarla más tarde si quieres.')}</p>`);
        const yes = document.createElement('button');
        yes.className = 'btn danger full mt';
        yes.textContent = t('Eliminar');
        yes.addEventListener('click', async () => {
          try { await eliminarAmistad(a.id); closeFn(); onCambio(); }
          catch { toast(t('Algo no funcionó. Intenta de nuevo.')); }
        });
        modal.appendChild(yes);
      });
    });
    fila.appendChild(btn);
    card.appendChild(fila);
  });
}
