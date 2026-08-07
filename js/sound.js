// Sonido opcional y silenciable: un chime corto al completar una
// micro-acción (marcar hábito, agua, "Tu paso de hoy"). Sintetizado con
// Web Audio en vez de un archivo de audio, así no hay nada que cachear ni
// que agregar a la CSP. Si el navegador bloquea el audio por lo que sea,
// falla en silencio — nunca debe romper la interacción real.
import { getState } from './store.js';

let ctx = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function sonidoActivado() {
  return getState().sonidoActivado !== false;
}

// Dos notas cortas y ascendentes (mi5 → la5): el mismo tipo de intervalo
// alegre que usan la mayoría de apps de hábitos para "correcto/logrado".
export function playCheckSound() {
  if (!sonidoActivado()) return;
  try {
    const audioCtx = getCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const notas = [660, 880];
    notas.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = audioCtx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  } catch {
    // Audio no disponible (autoplay bloqueado, sin soporte, etc.) — silencioso.
  }
}
