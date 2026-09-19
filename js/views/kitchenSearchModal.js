// "¿Qué tienes en casa?" — busca en el catálogo REAL de recetas por
// ingrediente o antojo (nunca genera recetas nuevas por IA: se mantiene
// dentro del principio de "solo info comprobada" de NutriRuta).
import { openModal, navigate } from '../app.js';
import { esc, getState } from '../store.js';
import { buscarPorIngredientes, displayRecipe, trafficLight } from '../menu.js';
import { t } from '../i18n.js';

export function openKitchenSearchModal(onOpenRecipe) {
  openModal((modal) => {
    modal.innerHTML = `
      <h2>${t('¿Qué tienes en casa?')}</h2>
      <p class="small muted mt">${t('Escribe ingredientes o lo que se te antoja, separados por coma.')}</p>
      <input type="text" id="ks-input" class="auth-input" placeholder="${t('Ej: huevos, avena, banano')}" style="margin-top:10px">
      <div class="mt" id="ks-resultados"></div>`;
    const input = modal.querySelector('#ks-input');
    const resultados = modal.querySelector('#ks-resultados');
    const { user } = getState();

    // Token de carrera: si la usuaria sigue escribiendo, una respuesta
    // vieja que llega tarde del servidor ya no debe pisar el resultado de
    // la búsqueda más reciente.
    let ultimaBusqueda = 0;
    async function buscar() {
      const texto = input.value;
      const idBusqueda = ++ultimaBusqueda;
      if (!texto.trim()) {
        resultados.innerHTML = '';
        return;
      }
      resultados.innerHTML = `<p class="small muted mt">${t('Cargando…')}</p>`;
      const encontradas = await buscarPorIngredientes(texto);
      if (idBusqueda !== ultimaBusqueda) return;
      if (!encontradas.length) {
        resultados.innerHTML = `<p class="small muted mt">${t('No encontré recetas con eso todavía. Prueba con otro ingrediente.')}</p>`;
        return;
      }
      resultados.innerHTML = `<p class="small muted">${t('Encontré {n} opción{s}.', { n: encontradas.length, s: encontradas.length === 1 ? '' : 'es' })}</p>`;
      for (const recipe of encontradas.slice(0, 15)) {
        // Recetas bloqueadas (no gratis, sin Premium) vuelven del servidor
        // sin ingredientes/pasos/descripción -- mismo límite del Recetario,
        // ya no una búsqueda sin ningún tope como antes.
        const shown = recipe.bloqueada ? { nombre: recipe.nombre, emoji: recipe.emoji } : displayRecipe(recipe, user.exclusiones);
        const light = trafficLight(recipe, user.perfiles);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'plan-option';
        card.style.marginTop = '8px';
        card.innerHTML = `
          <span style="font-size:1.6rem">${esc(shown.emoji)}</span>
          <span class="plan-option-body">
            <strong>${esc(shown.nombre)}</strong>
            <div class="small mt">${recipe.bloqueada ? `🔒 ${t('Premium')}` : `<span class="dot ${light}"></span>`}</div>
          </span>`;
        card.addEventListener('click', () => recipe.bloqueada ? navigate('plans') : onOpenRecipe(recipe));
        resultados.appendChild(card);
      }
    }

    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(buscar, 250);
    });
    input.focus();
  });
}
