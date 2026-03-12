// ─── Swap these filenames to change the music ───────────────────────────────
export const MUSIC_FILES = {
  LOBBY:     `${import.meta.env.BASE_URL}music/Azure Glass Lobby.wav`,
  SELECTION: `${import.meta.env.BASE_URL}music/Celestial Vow.wav`,
  GAME:      `${import.meta.env.BASE_URL}music/Te amo 4.wav`,
  // Note: Binary Dawn Tactics.wav for actual. Update later
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
  private pendingSrc: string | null = null;
  private readonly resumeOnInteraction = (): void => {
    document.removeEventListener('pointerdown', this.resumeOnInteraction);
    if (this.pendingSrc) {
      const src = this.pendingSrc;
      this.pendingSrc = null;
      this.play(src);
    }
  };

  play(src: string): void {
    this.pendingSrc = null;
    document.removeEventListener('pointerdown', this.resumeOnInteraction);
    this.stop();
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = masterVolume;
    this.audio = audio;
    activeAudio = audio;
    audio.play().catch(() => {
      this.pendingSrc = src;
      document.addEventListener('pointerdown', this.resumeOnInteraction);
    });
  }

  stop(): void {
    this.pendingSrc = null;
    document.removeEventListener('pointerdown', this.resumeOnInteraction);
    if (!this.audio) return;
    this.audio.pause();
    this.audio.src = '';
    if (activeAudio === this.audio) activeAudio = null;
    this.audio = null;
  }

  dispose(): void { this.stop(); }
}
