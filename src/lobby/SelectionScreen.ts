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
    this.container.className = 'at-screen';
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
    title.className = 'at-selection-title';
    this.container.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.textContent = this.localTeam !== null ? `You (Team ${team})` : `Team ${team}`;
    subtitle.className = 'at-selection-subtitle';
    this.container.appendChild(subtitle);

    // Cards row
    const row = document.createElement('div');
    row.className = 'at-card-row';
    this.container.appendChild(row);

    const cards: HTMLDivElement[] = [];

    roster.forEach((char, i) => {
      const card = this.makeChampionCard(char, i);
      cards.push(card);

      const alreadyPicked = Object.values(this.selectedChampionByTeam).includes(char.playerIndex);
      if (alreadyPicked) {
        card.classList.add('at-champion-card--disabled');
        row.appendChild(card);
        return;
      }

      card.addEventListener('mouseenter', () => {
        playHoverSfx();
      });
      card.addEventListener('click', () => {
        selectedIdx = i;
        for (let j = 0; j < cards.length; j++) {
          if (Object.values(this.selectedChampionByTeam).includes(roster[j]?.playerIndex)) continue;
          cards[j].classList.toggle('at-champion-card--selected', j === i);
        }
        lockBtn.disabled = false;
      });
      row.appendChild(card);
    });

    // Lock In button
    const lockBtn = document.createElement('button');
    lockBtn.textContent = 'Lock In';
    lockBtn.disabled = true;
    lockBtn.className = 'at-btn';
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

  private makeChampionCard(char: CharacterConfig, cardIndex: number): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'at-champion-card';
    card.style.animationDelay = `${cardIndex * 0.08}s`;

    const imageArea = document.createElement('div');
    imageArea.className = 'at-champion-card__image-area';
    const img = document.createElement('img');
    img.src = char.spritePath;
    imageArea.appendChild(img);
    card.appendChild(imageArea);

    const infoArea = document.createElement('div');
    infoArea.className = 'at-champion-card__info-area';

    const name = document.createElement('p');
    name.textContent = char.name;
    name.className = 'at-champion-card__name';
    infoArea.appendChild(name);

    const stats = [
      `HP ${char.hp}`,
      `STR ${char.strength}`,
      `DEF ${char.defense}`,
      `MV ${char.moveRange}`,
      `RNG ${char.attackRange}`,
    ];
    const statsEl = document.createElement('p');
    statsEl.textContent = stats.join(' · ');
    statsEl.className = 'at-champion-card__stats';
    infoArea.appendChild(statsEl);

    if (char.skills.length > 0) {
      const skillEl = document.createElement('p');
      const skillName = char.skills[0].name.length > 24
        ? char.skills[0].name.slice(0, 24) + '…'
        : char.skills[0].name;
      skillEl.textContent = `✦ ${skillName}`;
      skillEl.className = 'at-champion-card__skill';
      infoArea.appendChild(skillEl);
    }

    card.appendChild(infoArea);
    return card;
  }
}
