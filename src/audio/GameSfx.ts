import { gameConfig } from '../config/gameConfig';

export function playSelectSound(): void {
  try {
    const ctx = new AudioContext();
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    playTone(523, ctx.currentTime, 0.14);        // C5
    playTone(659, ctx.currentTime + 0.09, 0.18); // E5
    setTimeout(() => ctx.close(), 500);
  } catch { /* AudioContext may be blocked */ }
}

export function playInvalidSound(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(gameConfig.audio.gain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
    setTimeout(() => ctx.close(), 500);
  } catch { /* AudioContext may be blocked */ }
}

export function playHoverSfx(): void {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.connect(ctx.destination);

    const freqs = [440, 554];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.connect(gain);
      const t = ctx.currentTime + i * 0.06;
      osc.start(t);
      osc.stop(t + 0.06);
    });

    setTimeout(() => ctx.close(), 500);
  } catch { /* AudioContext may be blocked */ }
}

export function playLockInSfx(): void {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.connect(ctx.destination);

    const freqs = [523, 659, 784];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.connect(gain);
      const t = ctx.currentTime + i * 0.1;
      osc.start(t);
      osc.stop(t + 0.12);
    });

    setTimeout(() => ctx.close(), 800);
  } catch { /* AudioContext may be blocked */ }
}
