// Sonido opcional y silenciable: un sonido corto y distinto según qué se
// completó (marcar hábito, agua, "Tu paso de hoy"), sintetizado con Web
// Audio en vez de archivos de audio — nada que cachear ni que agregar a
// la CSP. Si el navegador bloquea el audio por lo que sea, falla en
// silencio — nunca debe romper la interacción real.
import { getState } from './store.js';

let ctx = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function sonidoActivado() {
  return getState().sonidoActivado !== false;
}

function tono(audioCtx, freq, start, dur, { type = 'sine', peak = 0.18 } = {}) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function conAudio(fn) {
  if (!sonidoActivado()) return;
  try {
    const audioCtx = getCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    fn(audioCtx);
  } catch {
    // Audio no disponible (autoplay bloqueado, sin soporte, etc.) — silencioso.
  }
}

// Hábitos: dos notas cortas y ascendentes (mi5 → la5), el chime genérico
// de "correcto/logrado" que usan la mayoría de apps.
export function playCheckSound() {
  conAudio((audioCtx) => {
    [660, 880].forEach((freq, i) => tono(audioCtx, freq, audioCtx.currentTime + i * 0.09, 0.22));
  });
}

// Agua: un "plink" de gota (barrido de frecuencia hacia abajo) + un
// soplo corto de ruido filtrado para la textura de splash.
export function playWaterSound() {
  conAudio((audioCtx) => {
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, start);
    osc.frequency.exponentialRampToValueAtTime(320, start + 0.16);
    gain.gain.setValueAtTime(0.22, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.22);

    // Splash: ráfaga breve de ruido pasada por un filtro pasa-banda.
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.12);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.12, start);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    noise.connect(filter).connect(noiseGain).connect(audioCtx.destination);
    noise.start(start);
  });
}

// "Tu paso de hoy": un pequeño destello — arpegio ascendente de 4 notas
// agudas, más mágico/celebratorio que el chime genérico de hábitos.
export function playSparkleSound() {
  conAudio((audioCtx) => {
    const start = audioCtx.currentTime;
    [988, 1245, 1568, 1976].forEach((freq, i) => {
      tono(audioCtx, freq, start + i * 0.055, 0.28, { type: 'triangle', peak: 0.13 });
    });
  });
}
