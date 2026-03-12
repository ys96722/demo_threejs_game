import type { GameMode } from '../core/GameMode';
import type { ServerMessage } from '../net/protocol';
import { API_BASE, WS_BASE } from '../config/env';
import { MusicPlayer, MUSIC_FILES } from '../audio/MusicPlayer';
import { SelectionScreen } from './SelectionScreen';
import { StoreScreen } from './StoreScreen';
import { characters as allCharacters, teamSpawnCoords } from '../config/gameConfig';
import type { CharacterConfig } from '../types/characters';

type LobbyPhase = 'MENU' | 'PVP_MENU' | 'JOIN_INPUT' | 'WAITING' | 'SELECTING' | 'STORE';

export class LobbyScreen {
  private container: HTMLDivElement;
  private phase: LobbyPhase = 'MENU';
  private ws: WebSocket | null = null;
  private music = new MusicPlayer();
  private selectionScreen: SelectionScreen | null = null;
  private storeScreen: StoreScreen | null = null;
  private pvpRoster: CharacterConfig[] = [];

  constructor(private onGameReady: (mode: GameMode) => void) {
    this.container = document.createElement('div');
    this.container.className = 'at-screen';
    document.body.appendChild(this.container);

    this.music.play(MUSIC_FILES.LOBBY);

    this.render();
  }

  dispose(): void {
    this.music.dispose();
    this.selectionScreen?.dispose();
    this.storeScreen?.dispose();
    this.container.remove();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private render(): void {
    this.container.innerHTML = '';
    switch (this.phase) {
      case 'MENU':       return this.renderMenu();
      case 'PVP_MENU':   return this.renderPvpMenu();
      case 'JOIN_INPUT': return this.renderJoinInput();
      case 'WAITING':    return this.renderWaiting('Waiting for opponent…');
      case 'SELECTING':  return; // SelectionScreen is mounted separately
      case 'STORE':      return; // StoreScreen is mounted separately
    }
  }

  private renderMenu(): void {
    this.mainTitle('SRPG Demo');
    this.btn('Quick Test (Solo)', () => this.startSoloSelection(), false, 0);
    this.btn('PvP', () => {
      this.phase = 'PVP_MENU';
      this.render();
    }, false, 1);
    this.btn('Campaign', () => this.toast('Campaign — coming soon!'), true, 2);
    this.btn('Store', () => this.startStore(), false, 3);
  }

  private renderPvpMenu(): void {
    this.title('PvP');
    this.btn('Create Lobby', () => this.handleCreateLobby(), false, 0);
    this.btn('Join Lobby', () => {
      this.phase = 'JOIN_INPUT';
      this.render();
    }, false, 1);
    this.btn('← Back', () => {
      this.phase = 'MENU';
      this.render();
    }, false, 2);
  }

  private renderJoinInput(): void {
    this.title('Join Lobby');

    const input = document.createElement('input');
    input.placeholder = 'Enter lobby code';
    input.className = 'at-input';
    this.container.appendChild(input);

    const errDiv = document.createElement('div');
    errDiv.className = 'at-error';
    this.container.appendChild(errDiv);

    this.btn('Join', async () => {
      const code = input.value.trim().toUpperCase();
      if (!code) { errDiv.textContent = 'Enter a code first.'; return; }
      try {
        const res = await fetch(`${API_BASE}/lobby/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json() as { ok: boolean; team?: number; error?: string };
        if (!data.ok) { errDiv.textContent = data.error ?? 'Invalid code.'; return; }
        this.connectWs(code, data.team!);
      } catch {
        errDiv.textContent = 'Could not reach server.';
      }
    }, false, 0);
    this.btn('← Back', () => {
      this.phase = 'PVP_MENU';
      this.render();
    }, false, 1);

    input.focus();
  }

  private renderWaiting(msg: string): void {
    const p = document.createElement('p');
    p.textContent = msg;
    p.className = 'at-status-text';
    this.container.appendChild(p);

    this.btn('← Cancel', () => {
      this.ws?.close();
      this.ws = null;
      this.phase = 'PVP_MENU';
      this.render();
    }, false, 0);
  }

  // ---------------------------------------------------------------------------
  // Solo selection flow
  // ---------------------------------------------------------------------------

  private startSoloSelection(): void {
    this.phase = 'SELECTING';
    this.render(); // clears container
    this.container.style.display = 'none'; // hide lobby container
    this.music.stop();

    this.selectionScreen = new SelectionScreen(
      null,
      allCharacters,
      null,
      (selections, board) => {
        this.dispose();
        this.onGameReady({ kind: 'solo', selections, board });
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Store flow
  // ---------------------------------------------------------------------------

  private startStore(): void {
    this.phase = 'STORE';
    this.render(); // clears container
    this.container.style.display = 'none';
    this.music.stop();

    this.storeScreen = new StoreScreen(() => {
      this.storeScreen?.dispose();
      this.storeScreen = null;
      this.container.style.display = 'flex';
      this.phase = 'MENU';
      this.music.play(MUSIC_FILES.LOBBY);
      this.render();
    });
  }

  // ---------------------------------------------------------------------------
  // Lobby actions
  // ---------------------------------------------------------------------------

  private async handleCreateLobby(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/lobby/create`, { method: 'POST' });
      const data = await res.json() as { code: string };
      this.phase = 'WAITING';
      this.render();
      this.showCode(data.code);
      this.connectWs(data.code, 1);
    } catch {
      this.toast('Could not reach server.');
    }
  }

  private showCode(code: string): void {
    const codeBox = document.createElement('div');
    codeBox.className = 'at-code-box';
    const label = document.createElement('p');
    label.textContent = 'Share this code with your opponent:';
    label.className = 'at-code-label';
    const codeEl = document.createElement('p');
    codeEl.textContent = code;
    codeEl.className = 'at-code-value';
    codeBox.appendChild(label);
    codeBox.appendChild(codeEl);
    this.container.appendChild(codeBox);
  }

  private connectWs(code: string, team: number): void {
    this.ws = new WebSocket(`${WS_BASE}/ws/${code}?team=${team}`);

    this.ws.onopen = () => {
      // Connection established; server will send CHAMPION_SELECTION_START when both connect
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      const msg = JSON.parse(String(ev.data)) as ServerMessage;

      if (msg.type === 'CHAMPION_SELECTION_START') {
        this.pvpRoster = msg.payload.characters.map(entry => {
          const localChar = allCharacters.find(c => c.playerIndex === entry.playerIndex);
          return {
            playerIndex: entry.playerIndex,
            team: 0,  // placeholder; will be set per-player at game start
            name: entry.name,
            hp: entry.hp,
            strength: entry.strength,
            intellect: entry.intellect,
            defense: entry.defense,
            resistance: entry.resistance,
            moveRange: entry.moveRange,
            attackRange: entry.attackRange,
            spritePath: localChar?.spritePath ?? '',
            startCoord: { col: 0, row: 0 }, // placeholder
            skills: entry.skills,
          } satisfies CharacterConfig;
        });
        this.startPvpSelection(team);
        return;
      }

      if (msg.type === 'GAME_START') {
        const ws = this.ws!;
        this.ws = null;
        const selections: Record<number, number> = Object.fromEntries(
          Object.entries(msg.payload.selections as Record<string, number>).map(([k, v]) => [Number(k), v]),
        );
        const board = (msg.payload.board ?? 'tactical') as import('../core/GameMode').BoardType;

        // Build CharacterConfig[] with correct team + spawn from selections
        const roster: CharacterConfig[] = (Object.entries(selections) as [string, number][]).map(([teamStr, playerIdx]) => {
          const base = this.pvpRoster.find(c => c.playerIndex === playerIdx)!;
          const team = Number(teamStr);
          return { ...base, team, startCoord: teamSpawnCoords[team] };
        });

        this.selectionScreen?.dispose();
        this.selectionScreen = null;
        this.dispose();
        this.onGameReady({ kind: 'pvp', localTeam: msg.payload.localTeam, ws, selections, roster, board });
      }
    };

    this.ws.onerror = () => this.toast('WebSocket connection failed.');
  }

  private startPvpSelection(localTeam: number): void {
    this.phase = 'SELECTING';
    this.render();
    this.container.style.display = 'none';
    this.music.stop();

    this.selectionScreen = new SelectionScreen(
      localTeam,
      this.pvpRoster,
      this.ws,
      (_sel, _board) => {
        // In PvP, GAME_START from server drives onGameReady.
        // Show "waiting" UI while server collects both selections.
        this.selectionScreen?.dispose();
        this.container.style.display = 'flex';
        this.phase = 'WAITING';
        this.container.innerHTML = '';
        this.renderWaiting('Waiting for opponent to lock in…');
      },
    );
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  private mainTitle(text: string): void {
    const h1 = document.createElement('h1');
    h1.textContent = text;
    h1.className = 'at-lobby-title';
    this.container.appendChild(h1);
  }

  private title(text: string): void {
    const h1 = document.createElement('h1');
    h1.textContent = text;
    h1.className = 'at-section-title';
    this.container.appendChild(h1);
  }

  private btn(label: string, onClick: () => void, disabled = false, staggerIndex = 0): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.disabled = disabled;
    b.className = 'at-btn at-btn-stagger';
    b.style.animationDelay = `${staggerIndex * 0.07}s`;
    b.addEventListener('click', onClick);
    this.container.appendChild(b);
    return b;
  }

  private toast(msg: string): void {
    const t = document.createElement('div');
    t.textContent = msg;
    t.className = 'at-toast';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
}
