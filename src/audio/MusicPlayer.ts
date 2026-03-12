// ─── Swap these filenames to change the music ───────────────────────────────
export const MUSIC_FILES = {
  LOBBY:     `${import.meta.env.BASE_URL}music/Azure Glass Lobby.wav`,
  SELECTION: `${import.meta.env.BASE_URL}music/Celestial Vow.wav`,
  GAME:      `${import.meta.env.BASE_URL}music/Binary Dawn Tactics.wav`,
};
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
