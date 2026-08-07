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

// Respiración guiada (SOS antojo): un "soplo" de ruido filtrado que se
// mueve en tono, no un chime — imita el sonido del aire, no un logro.
// Inhala sube de tono, exhala baja; misma duración que cada fase del
// ejercicio en sos.js para que el sonido y el círculo vayan sincronizados.
function soplo(audioCtx, { desde, hasta, dur, peak = 0.1 }) {
  const start = audioCtx.currentTime;
  const bufferSize = Math.floor(audioCtx.sampleRate * dur);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(desde, start);
  filter.frequency.linearRampToValueAtTime(hasta, start + dur);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + dur * 0.3);
  gain.gain.linearRampToValueAtTime(0, start + dur);
  noise.connect(filter).connect(gain).connect(audioCtx.destination);
  noise.start(start);
  noise.stop(start + dur + 0.05);
}

export function playInhaleSound(dur = 3.3) {
  conAudio((audioCtx) => soplo(audioCtx, { desde: 300, hasta: 1100, dur }));
}

export function playExhaleSound(dur = 3.3) {
  conAudio((audioCtx) => soplo(audioCtx, { desde: 1100, hasta: 250, dur }));
}

// Día completo (nueva racha): fanfarria corta — arpegio que sube y cierra
// en acorde, para el hito más grande del día, distinto del destello de una
// sola micro-acción.
export function playCelebrateSound() {
  conAudio((audioCtx) => {
    const start = audioCtx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      tono(audioCtx, freq, start + i * 0.09, 0.24, { type: 'triangle', peak: 0.14 });
    });
    [784, 988, 1175].forEach((freq) => {
      tono(audioCtx, freq, start + 0.3, 0.5, { type: 'sine', peak: 0.1 });
    });
  });
}
