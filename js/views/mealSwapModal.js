// "¿No quieres comer esto? Busquemos otra opción" — antes swapMeal rotaba
// en silencio a la siguiente receta sin que la usuaria eligiera nada. Ahora
// muestra hasta 3 alternativas reales (mismo filtro de perfil/exclusiones
// que ya usaba el menú) con un motivo real de por qué encajan.
import { openModal } from '../app.js';
import { esc } from '../store.js';
import { alternativesFor, swapMeal, displayRecipe } from '../menu.js';

export function openMealSwapModal(mealId, mealTitle, exclusiones, onChosen) {
  const { alternatives } = alternativesFor(mealId);
  if (!alternatives.length) {
    openModal((modal) => {
      modal.innerHTML = `<h2>Busquemos otra opción</h2><p class="small muted mt">No hay más alternativas disponibles para ${esc(mealTitle)} con tus preferencias actuales.</p>`;
    });
    return;
  }
  openModal((modal, closeFn) => {
    modal.innerHTML = `
      <h2>Busquemos otra opción</h2>
      <p class="small muted mt">Para ${esc(mealTitle)}, compatibles con tu Ruta:</p>
      <div class="mt" id="msw-lista"></div>`;
    const lista = modal.querySelector('#msw-lista');
    alternatives.forEach(({ recipe, index, motivo }) => {
      const shown = displayRecipe(recipe, exclusiones);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'plan-option';
      card.style.marginBottom = '8px';
      card.innerHTML = `
        <span style="font-size:1.6rem">${esc(shown.emoji)}</span>
        <span class="plan-option-body">
          <strong>${esc(shown.nombre)}</strong>
          <div class="small muted mt">${esc(motivo)}</div>
        </span>`;
      card.addEventListener('click', () => {
        swapMeal(mealId, undefined, index);
        closeFn();
        onChosen?.();
      });
      lista.appendChild(card);
    });
  });
}
