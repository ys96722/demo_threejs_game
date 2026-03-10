import { bus } from '../core/EventBus';
import { EVENTS } from '../types/events';
import type { Character } from '../entities/Character';
import type { ClientMessage, ServerMessage, GameStateSnapshot } from './protocol';

export class GameClient {
  constructor(
    private ws: WebSocket,
    private characters: Map<number, Character>,
  ) {
    ws.onmessage = (ev: MessageEvent) => this.handleMessage(ev);
    ws.onclose = () => bus.emit(EVENTS.OPPONENT_DISCONNECTED, {});
  }

  send(msg: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  close(): void {
    this.ws.close();
  }

  private handleMessage(ev: MessageEvent): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(String(ev.data)) as ServerMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case 'STATE_UPDATE':
        this.applyStateUpdate(msg.payload);
        break;
      case 'TURN_CHANGED':
        bus.emit(EVENTS.TURN_CHANGED, { player: msg.payload.activeTeam, turnCount: msg.payload.turnCount });
        break;
      case 'GAME_OVER':
        bus.emit(EVENTS.GAME_OVER, { winnerTeam: msg.payload.winnerTeam });
        break;
      case 'ACTION_REJECTED':
        bus.emit(EVENTS.NETWORK_ACTION_REJECTED, { reason: msg.payload.reason });
        break;
      case 'OPPONENT_DISCONNECTED':
        bus.emit(EVENTS.OPPONENT_DISCONNECTED, {});
        break;
      case 'CHAT':
        bus.emit(EVENTS.CHAT_RECEIVED, { team: msg.payload.team, text: msg.payload.text });
        break;
      case 'GAME_START':
        // Handled by LobbyScreen before GameClient is attached; no-op here.
        break;
    }
  }

  private applyStateUpdate(snapshot: GameStateSnapshot): void {
    for (const cs of snapshot.characters) {
      const char = this.characters.get(cs.playerIndex);
      if (!char) continue;

      // Trigger movement animation if the character's position changed on the server.
      if (char.coord.col !== cs.coord.col || char.coord.row !== cs.coord.row) {
        const from = { col: char.coord.col, row: char.coord.row };
        bus.emit(EVENTS.CHARACTER_MOVE_START, { from, to: cs.coord });
        char.moveTo(cs.coord);
      }

      char.setHp(cs.hp);
      char.defense = cs.defense;
      char.moveTokens = cs.moveTokens;
      char.actionTokens = cs.actionTokens;
      char.updateTokenDisplay();
    }
  }
}
