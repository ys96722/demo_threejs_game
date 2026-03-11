import type { GameMode } from '../core/GameMode';
import type { ServerMessage } from '../net/protocol';
import { API_BASE, WS_BASE } from '../config/env';

type LobbyPhase = 'MENU' | 'PVP_MENU' | 'JOIN_INPUT' | 'WAITING';

export class LobbyScreen {
  private container: HTMLDivElement;
  private phase: LobbyPhase = 'MENU';
  private ws: WebSocket | null = null;

  constructor(private onGameReady: (mode: GameMode) => void) {
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed', inset: '0', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#030712', fontFamily: 'sans-serif', zIndex: '500',
    });
    document.body.appendChild(this.container);
    this.render();
  }

  dispose(): void {
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
    }
  }

  private renderMenu(): void {
    this.title('SRPG Demo');
    this.btn('Quick Test (Solo)', () => {
      this.dispose();
      this.onGameReady({ kind: 'solo' });
    });
    this.btn('PvP', () => {
      this.phase = 'PVP_MENU';
      this.render();
    });
    this.btn('Campaign', () => this.toast('Campaign — coming soon!'), true);
  }

  private renderPvpMenu(): void {
    this.title('PvP');
    this.btn('Create Lobby', () => this.handleCreateLobby());
    this.btn('Join Lobby', () => {
      this.phase = 'JOIN_INPUT';
      this.render();
    });
    this.btn('← Back', () => {
      this.phase = 'MENU';
      this.render();
    });
  }

  private renderJoinInput(): void {
    this.title('Join Lobby');

    const input = document.createElement('input');
    input.placeholder = 'Enter lobby code';
    Object.assign(input.style, {
      padding: '10px 16px', borderRadius: '6px', border: '1px solid #444',
      background: '#111', color: '#fff', fontSize: '18px', textAlign: 'center',
      letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '12px', width: '180px',
    });
    this.container.appendChild(input);

    const errDiv = document.createElement('div');
    Object.assign(errDiv.style, { color: '#f87171', fontSize: '13px', marginBottom: '8px', minHeight: '18px' });
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
    });
    this.btn('← Back', () => {
      this.phase = 'PVP_MENU';
      this.render();
    });

    input.focus();
  }

  private renderWaiting(msg: string): void {
    const p = document.createElement('p');
    p.textContent = msg;
    Object.assign(p.style, { color: '#aaa', fontSize: '18px' });
    this.container.appendChild(p);

    this.btn('← Cancel', () => {
      this.ws?.close();
      this.ws = null;
      this.phase = 'PVP_MENU';
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
    Object.assign(codeBox.style, {
      marginTop: '24px', padding: '16px 32px', background: '#111',
      border: '1px solid #333', borderRadius: '8px', textAlign: 'center',
    });
    const label = document.createElement('p');
    label.textContent = 'Share this code with your opponent:';
    Object.assign(label.style, { color: '#aaa', fontSize: '13px', margin: '0 0 8px' });
    const codeEl = document.createElement('p');
    codeEl.textContent = code;
    Object.assign(codeEl.style, {
      color: '#fff', fontSize: '32px', fontWeight: 'bold',
      letterSpacing: '6px', margin: '0',
    });
    codeBox.appendChild(label);
    codeBox.appendChild(codeEl);
    this.container.appendChild(codeBox);
  }

  private connectWs(code: string, team: number): void {
    this.ws = new WebSocket(`${WS_BASE}/ws/${code}?team=${team}`);

    this.ws.onopen = () => {
      // Connection established; server will send GAME_START when both players connect.
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      const msg = JSON.parse(String(ev.data)) as ServerMessage;
      if (msg.type === 'GAME_START') {
        const ws = this.ws!;
        this.ws = null;
        this.dispose();
        this.onGameReady({ kind: 'pvp', localTeam: msg.payload.localTeam, ws });
      }
    };

    this.ws.onerror = () => this.toast('WebSocket connection failed.');
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  private title(text: string): void {
    const h1 = document.createElement('h1');
    h1.textContent = text;
    Object.assign(h1.style, { color: '#fff', fontSize: '36px', marginBottom: '32px' });
    this.container.appendChild(h1);
  }

  private btn(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.disabled = disabled;
    Object.assign(b.style, {
      padding: '12px 32px', borderRadius: '6px', border: 'none',
      background: disabled ? '#333' : 'rgba(255,255,255,0.12)',
      color: disabled ? '#666' : '#fff', fontSize: '16px',
      cursor: disabled ? 'default' : 'pointer', marginBottom: '10px', minWidth: '200px',
    });
    b.addEventListener('click', onClick);
    this.container.appendChild(b);
    return b;
  }

  private toast(msg: string): void {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
      background: '#1f2937', color: '#fff', padding: '10px 24px',
      borderRadius: '6px', fontSize: '14px', zIndex: '600',
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
}
