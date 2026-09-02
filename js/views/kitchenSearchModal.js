// "¿Qué tienes en casa?" — busca en el catálogo REAL de recetas por
// ingrediente o antojo (nunca genera recetas nuevas por IA: se mantiene
// dentro del principio de "solo info comprobada" de NutriRuta).
import { openModal } from '../app.js';
import { esc, getState } from '../store.js';
import { buscarPorIngredientes, displayRecipe, trafficLight } from '../menu.js';

export function openKitchenSearchModal(onOpenRecipe) {
  openModal((modal) => {
    modal.innerHTML = `
      <h2>¿Qué tienes en casa?</h2>
      <p class="small muted mt">Escribe ingredientes o lo que se te antoja, separados por coma.</p>
      <input type="text" id="ks-input" class="auth-input" placeholder="Ej: huevos, avena, banano" style="margin-top:10px">
      <div class="mt" id="ks-resultados"></div>`;
    const input = modal.querySelector('#ks-input');
    const resultados = modal.querySelector('#ks-resultados');
    const { user } = getState();

    function buscar() {
      const encontradas = buscarPorIngredientes(input.value);
      if (!input.value.trim()) {
        resultados.innerHTML = '';
        return;
      }
      if (!encontradas.length) {
        resultados.innerHTML = '<p class="small muted mt">No encontré recetas con eso todavía. Prueba con otro ingrediente.</p>';
        return;
      }
      resultados.innerHTML = `<p class="small muted">Encontré ${encontradas.length} opción${encontradas.length === 1 ? '' : 'es'}.</p>`;
      for (const recipe of encontradas.slice(0, 15)) {
        const shown = displayRecipe(recipe, user.exclusiones);
        const light = trafficLight(recipe, user.perfiles);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'plan-option';
        card.style.marginTop = '8px';
        card.innerHTML = `
          <span style="font-size:1.6rem">${esc(shown.emoji)}</span>
          <span class="plan-option-body">
            <strong>${esc(shown.nombre)}</strong>
            <div class="small mt"><span class="dot ${light}"></span></div>
          </span>`;
        card.addEventListener('click', () => onOpenRecipe(recipe));
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
