// Tiny synthesized SFX via WebAudio — zero asset downloads, works offline.
// Respects the mute setting persisted in localStorage.

let ctx: AudioContext | null = null;
let muted = typeof localStorage !== 'undefined' && localStorage.getItem('kadi-muted') === '1';

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('kadi-muted', m ? '1' : '0');
  } catch {
    /* private mode — ignore */
  }
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, durMs: number, type: OscillatorType = 'triangle', gain = 0.12, whenMs = 0): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + whenMs / 1000;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + durMs / 1000 + 0.02);
}

export const sfx = {
  play: () => blip(520, 90),
  pick: () => blip(300, 110, 'sine'),
  shuffle: () => {
    blip(400, 60, 'square', 0.05);
    blip(500, 60, 'square', 0.05, 70);
    blip(620, 70, 'square', 0.05, 140);
  },
  penalty: () => blip(150, 220, 'sawtooth', 0.1),
  turn: () => blip(760, 80, 'sine', 0.08),
  kadi: () => {
    blip(523, 110);
    blip(659, 110, 'triangle', 0.12, 110);
    blip(784, 160, 'triangle', 0.12, 220);
  },
  win: () => {
    blip(523, 120);
    blip(659, 120, 'triangle', 0.12, 120);
    blip(784, 120, 'triangle', 0.12, 240);
    blip(1047, 260, 'triangle', 0.13, 360);
  },
  lose: () => {
    blip(392, 150);
    blip(330, 200, 'triangle', 0.1, 150);
  },
  error: () => blip(180, 140, 'square', 0.07),
};
