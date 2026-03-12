import type { BoardType } from '../core/GameMode';
import type { CharacterConfig } from '../types/characters';
import type { ClientMessage } from '../net/protocol';
import { playHoverSfx, playLockInSfx } from '../audio/GameSfx';
import { MusicPlayer, MUSIC_FILES } from '../audio/MusicPlayer';

type SelectionPhase = 'CHAMPION_T1' | 'CHAMPION_T2';

// ---------------------------------------------------------------------------
// SelectionScreen
// ---------------------------------------------------------------------------

export class SelectionScreen {
  private container: HTMLDivElement;
  private phase: SelectionPhase;
  private music = new MusicPlayer();
  private selectedChampionByTeam: Record<number, number | null> = { 1: null, 2: null };

  /**
   * @param localTeam  1 or 2 in PvP (pick only this team's champion); null for solo
   * @param roster     Flat array of all available characters
   * @param ws         WebSocket for PvP; null for solo
   * @param onReady    Called with selections (team→playerIndex) and board choice
   */
  constructor(
    private localTeam: number | null,
    private roster: CharacterConfig[],
    private ws: WebSocket | null,
    private onReady: (selections: Record<number, number>, board: BoardType) => void,
  ) {
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed', inset: '0', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--theme-lobby-bg)', fontFamily: 'sans-serif', zIndex: '500',
      gap: '0',
    });
    document.body.appendChild(this.container);
    this.music.play(MUSIC_FILES.SELECTION);

    // Solo: T1 picks first, then T2, then board
    // PvP: local team picks, then board (opponent picks simultaneously on their client)
    this.phase = 'CHAMPION_T1';
    this.render();
  }

  dispose(): void {
    this.music.dispose();
    this.container.remove();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private render(): void {
    this.container.innerHTML = '';
    switch (this.phase) {
      case 'CHAMPION_T1': return this.renderChampionPick(this.localTeam ?? 1);
      case 'CHAMPION_T2': return this.renderChampionPick(2);
    }
  }

  private renderChampionPick(team: number): void {
    const roster = this.roster;
    let selectedIdx: number | null = null;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Choose Your Champion';
    Object.assign(title.style, {
      color: 'var(--theme-text)', fontSize: '28px', margin: '0 0 8px',
    });
    this.container.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.textContent = this.localTeam !== null ? `You (Team ${team})` : `Team ${team}`;
    Object.assign(subtitle.style, {
      color: 'var(--theme-accent)', fontSize: '16px', margin: '0 0 24px', fontWeight: 'bold',
    });
    this.container.appendChild(subtitle);

    // Cards row
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '20px', marginBottom: '24px' });
    this.container.appendChild(row);

    const cards: HTMLDivElement[] = [];

    roster.forEach((char, i) => {
      const card = this.makeChampionCard(char);
      cards.push(card);

      const alreadyPicked = Object.values(this.selectedChampionByTeam).includes(char.playerIndex);
      if (alreadyPicked) {
        card.style.opacity = '0.35';
        card.style.cursor = 'not-allowed';
        row.appendChild(card);
        return;
      }

      card.addEventListener('mouseenter', () => {
        playHoverSfx();
        card.style.borderColor = 'var(--theme-accent)';
      });
      card.addEventListener('mouseleave', () => {
        if (selectedIdx !== i) card.style.borderColor = 'transparent';
      });
      card.addEventListener('click', () => {
        selectedIdx = i;
        for (let j = 0; j < cards.length; j++) {
          if (Object.values(this.selectedChampionByTeam).includes(roster[j]?.playerIndex)) continue;
          cards[j].style.borderColor = j === i ? 'var(--theme-accent)' : 'transparent';
          cards[j].style.boxShadow = j === i ? '0 0 12px var(--theme-accent)' : 'none';
        }
        lockBtn.disabled = false;
        Object.assign(lockBtn.style, {
          background: 'var(--theme-btn-bg)',
          color: 'var(--theme-btn-color)',
          cursor: 'pointer',
        });
      });
      row.appendChild(card);
    });

    // Lock In button
    const lockBtn = document.createElement('button');
    lockBtn.textContent = 'Lock In';
    lockBtn.disabled = true;
    Object.assign(lockBtn.style, {
      padding: '12px 40px', borderRadius: '6px', border: 'none',
      background: '#333', color: '#666', fontSize: '16px',
      cursor: 'default', minWidth: '200px',
    });
    lockBtn.addEventListener('click', () => {
      if (selectedIdx === null) return;
      playLockInSfx();

      const chosen = roster[selectedIdx];
      this.selectedChampionByTeam[team] = chosen.playerIndex;

      if (this.localTeam !== null) {
        // PvP: send champion selection to server immediately; board comes from GAME_START
        const msg: ClientMessage = {
          type: 'CHAMPION_SELECTED',
          payload: { team, characterIndex: chosen.playerIndex, board: '' },
        };
        this.ws?.send(JSON.stringify(msg));
        this.onReady({}, 'tactical'); // triggers "Waiting for opponent to lock in…" in LobbyScreen
      } else {
        // Solo: T1 → T2; T2 → done, build selections dict and call onReady
        if (team === 1) {
          this.phase = 'CHAMPION_T2';
          this.render();
        } else {
          const sel: Record<number, number> = {};
          for (const t of [1, 2] as const) {
            const idx = this.selectedChampionByTeam[t];
            if (idx !== null) sel[t] = idx;
          }
          this.onReady(sel, 'tactical');
        }
      }
    });
    this.container.appendChild(lockBtn);
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  private makeChampionCard(char: CharacterConfig): HTMLDivElement {
    const card = document.createElement('div');
    Object.assign(card.style, {
      background: 'var(--theme-panel-bg)',
      border: '2px solid transparent',
      borderRadius: '10px',
      padding: '16px',
      width: '160px',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      color: 'var(--theme-text)',
      userSelect: 'none',
    });

    const img = document.createElement('img');
    img.src = char.spritePath;
    Object.assign(img.style, {
      width: '80px', height: '80px',
      imageRendering: 'pixelated',
      display: 'block', margin: '0 auto 10px',
    });
    card.appendChild(img);

    const name = document.createElement('p');
    name.textContent = char.name;
    Object.assign(name.style, { margin: '0 0 6px', fontWeight: 'bold', fontSize: '15px' });
    card.appendChild(name);

    const stats = [
      `HP ${char.hp}`,
      `STR ${char.strength}`,
      `DEF ${char.defense}`,
      `MV ${char.moveRange}`,
      `RNG ${char.attackRange}`,
    ];
    const statsEl = document.createElement('p');
    statsEl.textContent = stats.join(' · ');
    Object.assign(statsEl.style, { margin: '0 0 6px', fontSize: '11px', opacity: '0.75' });
    card.appendChild(statsEl);

    if (char.skills.length > 0) {
      const skillEl = document.createElement('p');
      const skillName = char.skills[0].name.length > 24
        ? char.skills[0].name.slice(0, 24) + '…'
        : char.skills[0].name;
      skillEl.textContent = `✦ ${skillName}`;
      Object.assign(skillEl.style, {
        margin: '0', fontSize: '11px', color: 'var(--theme-accent)', fontStyle: 'italic',
      });
      card.appendChild(skillEl);
    }

    return card;
  }
}
