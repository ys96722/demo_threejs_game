import { bus } from './EventBus';
import { EVENTS } from '../types/events';

export type PlayerIndex = 1 | 2;

export class TurnManager {
  activePlayer: PlayerIndex = 1;

  nextTurn(): void {
    this.activePlayer = this.activePlayer === 1 ? 2 : 1;
    bus.emit(EVENTS.TURN_CHANGED, { player: this.activePlayer });
  }
}
