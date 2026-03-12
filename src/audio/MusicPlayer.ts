// ─── Swap these filenames to change the music ───────────────────────────────
export const MUSIC_FILES = {
  LOBBY:     '/music/Azure Glass Lobby.wav',//'/music/Echoes of the Chosen.wav',
  SELECTION: '/music/Celestial Vow.wav',//'/music/selection.mp3',
  GAME:      '/music/Binary Dawn Tactics.wav',//'/music/game.mp3',
} as const;
// ────────────────────────────────────────────────────────────────────────────

let masterVolume: number = parseFloat(localStorage.getItem('srpg-volume') ?? '0.4');
let activeAudio: HTMLAudioElement | null = null;

export function setMasterVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
  localStorage.setItem('srpg-volume', String(masterVolume));
  if (activeAudio) activeAudio.volume = masterVolume;
}

export function getMasterVolume(): number { return masterVolume; }

export class MusicPlayer {
  private audio: HTMLAudioElement | null = null;

  play(src: string): void {
    this.stop();
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = masterVolume;
    audio.play().catch(() => { /* autoplay policy — silently ignored */ });
    this.audio = audio;
    activeAudio = audio;
  }

  stop(): void {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.src = '';
    if (activeAudio === this.audio) activeAudio = null;
    this.audio = null;
  }

  dispose(): void { this.stop(); }
}
