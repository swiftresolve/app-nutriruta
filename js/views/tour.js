// Minitutorial inicial interactivo del dashboard: antes "Primeros pasos"
// era una lista de estado pasiva que repetía lo mismo que las tarjetas de
// abajo (mismo texto, dos veces en la misma pantalla). Ahora es un
// recorrido real -- resalta cada elemento de verdad con un "spotlight"
// (el resto de la pantalla se oscurece) y una burbuja con una mini
// explicación y un botón "Continuar", como el tour guiado de apps
// grandes. También explica lo que no se ve a simple vista (para qué son
// las gemas/NutriCoins/Pausas de Ruta y cómo se ganan) y lo que hace
// distinta a NutriRuta frente a otras apps -- no solo dónde tocar. Solo
// se muestra una vez, a cuentas nuevas.
import { getState, setState } from '../store.js';

// target: null = "slide" centrada sin spotlight (bienvenida/cierre,
// conceptos que no viven en un solo elemento de la pantalla).
// Función (no arreglo fijo) porque el saludo de bienvenida depende del
// sexo elegido en el quiz (user.sexo) -- 'Bienvenido' para hombre,
// 'Bienvenida' para mujer o sin dato (mismo criterio neutro-femenino que
// ya usa el resto de la app por defecto).
function crearPasos(sexo) {
  const bienvenida = sexo === 'hombre' ? 'Bienvenido' : 'Bienvenida';
  return [
  {
    target: null, titulo: `🌿 ${bienvenida} a NutriRuta`,
    texto: 'A diferencia de otras apps, aquí no cuentas calorías ni pesas cada gramo -- nos enfocamos en hábitos reales, con evidencia clínica real, nunca en números que agobian. Este recorrido rápido te muestra lo esencial.'
  },
  {
    target: '#hs-racha', titulo: '🔥 Tu racha (Días en Ruta)',
    texto: 'Cuenta tus días seguidos cuidándote. Sumas un día completando al menos 3 hábitos, o dando tu "paso de hoy".'
  },
  {
    target: '#hs-gemas', titulo: '💎 Gemas',
    texto: 'Se ganan solo con constancia (cada día completado, cada semana de tu plan) -- nunca se compran con dinero. Sirven para comprar Pausas de Ruta extra.'
  },
  {
    target: '#hs-nutricoins', titulo: '🪙 NutriCoins',
    texto: 'A diferencia de las gemas, estos sí se compran con dinero real -- para extras puntuales (como preguntas de más a SuSana). Nunca reemplazan tu constancia ni compran Pausas de Ruta.'
  },
  {
    target: '#hs-escudos', titulo: '🛡️ Pausas de Ruta',
    texto: 'Si un día no puedes cumplir, una Pausa cubre ese día sin romper tu racha -- se gana 1 cada 7 Días en Ruta, o se compra con gemas. Nunca te castiga por un mal día.'
  },
  {
    target: '#tour-paso', titulo: '🌱 Tu paso de hoy',
    texto: 'Una sola acción pequeña y concreta, pensada para tu situación real. Tócala cuando la hagas -- no hace falta más para empezar cada día.'
  },
  {
    target: '#tour-habitos', titulo: '✅ Hábitos de hoy',
    texto: 'Marca al menos 3 para sumar a tu racha. El agua y el menú se marcan solos cuando los registras de verdad, no hace falta tocarlos aparte.'
  },
  {
    target: '#tour-agua', titulo: '💧 Tu agua',
    texto: 'Registra cada vaso aquí, a tu ritmo -- tu meta se ajusta sola según tu peso y sexo, si los guardaste en Ajustes.'
  },
  {
    target: '[data-route="planner"]', titulo: '🥗 Recetas',
    texto: 'Tu menú del día y el recetario completo, filtrado según tu perfil de salud -- nada de recetas al azar.'
  },
  {
    target: '[data-route="sos"]', titulo: '💚 SOS antojo',
    texto: 'Cuando llegue un antojo fuerte, aquí tienes alternativas reales al momento -- sin culpa, sin regaños.'
  },
  {
    target: '[data-route="assistant"]', titulo: '💬 SuSana',
    texto: 'Tu guía con IA: conoce tu perfil real y te habla en el tono que tú elijas. Parte del plan Premium.'
  },
  {
    target: null, titulo: '🎉 Listo',
    texto: 'Ya conoces lo esencial de NutriRuta. El resto lo vas descubriendo a tu ritmo -- progreso, no perfección 🌿'
  }
  ];
}

// Mismo criterio que tenía "Primeros pasos": solo cuentas nuevas, sin
// ningún día completado todavía, y que no lo hayan visto ya.
export function tourVisible() {
  const state = getState();
  if (!state.onboarded) return false;
  if ((state.diasCumplidos || []).length > 0) return false;
  if (state.tourCompletado) return false;
  return true;
}

export function iniciarTour(onFin) {
  let i = 0;
  // Evita que un doble click (o un toque accidental repetido) dispare
  // pintarPaso() dos veces antes de que el primero termine de pintar,
  // lo que saltaba pasos de golpe.
  let avanzando = false;
  const PASOS = crearPasos(getState().user?.sexo);

  const overlay = document.createElement('div');
  overlay.className = 'tour-overlay';
  const spot = document.createElement('div');
  spot.className = 'tour-spot';
  const tip = document.createElement('div');
  tip.className = 'tour-tip';
  document.body.appendChild(overlay);
  document.body.appendChild(spot);
  document.body.appendChild(tip);

  function terminar() {
    setState({ tourCompletado: true });
    overlay.remove();
    spot.remove();
    tip.remove();
    if (onFin) onFin();
  }

  function avanzar() {
    if (avanzando) return;
    avanzando = true;
    i++;
    pintarPaso();
  }

  function pintarPaso() {
    const paso = PASOS[i];
    if (!paso) { terminar(); return; }

    const el = paso.target ? document.querySelector(paso.target) : null;
    // El elemento no existe en esta cuenta/pantalla en este momento (ej.
    // una tarjeta que no le aplica) -- se salta solo, nunca se queda
    // pegado en un paso imposible de mostrar.
    if (paso.target && !el) { i++; pintarPaso(); return; }

    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Espera a que termine el scroll suave antes de medir la posición
    // real -- medir antes daría las coordenadas de ANTES de moverse.
    setTimeout(() => {
      avanzando = false;
      const esUltimo = i === PASOS.length - 1;
      const esSlide = !el;

      if (esSlide) {
        // Sin elemento que señalar (bienvenida/cierre): el spotlight se
        // esconde, pero el fondo sigue oscuro parejo -- lo pone el propio
        // overlay en vez del truco de box-shadow del spot.
        spot.style.cssText = 'display:none';
        overlay.style.background = 'rgba(8, 18, 15, 0.74)';
      } else {
        overlay.style.background = 'transparent';
        const r = el.getBoundingClientRect();
        const pad = 6;
        spot.style.cssText = `top:${r.top - pad}px;left:${r.left - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;`;
      }

      tip.innerHTML = `
        <p class="small muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.03em;margin:0">Paso ${i + 1} de ${PASOS.length}</p>
        <h3 class="mt">${paso.titulo}</h3>
        <p class="small mt">${paso.texto}</p>
        <div class="row mt" style="justify-content:${esUltimo ? 'flex-end' : 'space-between'};align-items:center">
          ${esUltimo ? '' : '<button type="button" class="link-btn small" id="tour-saltar">Saltar</button>'}
          <button type="button" class="btn accent sm" id="tour-siguiente">${esUltimo ? 'Empezar 🌿' : 'Continuar →'}</button>
        </div>`;

      if (esSlide) {
        // Centrada en la pantalla, sin apuntar a nada.
        tip.style.cssText = 'position:fixed;z-index:201;top:50%;left:50%;transform:translate(-50%,-50%);';
      } else {
        const tipRect = tip.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const pad = 6;
        let top = r.bottom + pad + 12;
        if (top + tipRect.height > window.innerHeight - 16) top = Math.max(16, r.top - pad - tipRect.height - 12);
        const left = Math.min(Math.max(16, r.left), window.innerWidth - tipRect.width - 16);
        tip.style.cssText = `position:fixed;z-index:201;top:${top}px;left:${left}px;`;
      }

      tip.querySelector('#tour-siguiente').addEventListener('click', avanzar);
      tip.querySelector('#tour-saltar')?.addEventListener('click', avanzar);
    }, 320);
  }

  pintarPaso();
}
