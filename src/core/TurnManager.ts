import { bus } from './EventBus';
import { EVENTS } from '../types/events';

export type PlayerIndex = number;

export class TurnManager {
  private playerIndices: number[];
  private currentIndex = 0;
  turnCount = 1;

  constructor(playerIndices: number[]) {
    this.playerIndices = playerIndices;
  }

  get activePlayer(): number {
    return this.playerIndices[this.currentIndex];
  }

  nextTurn(): void {
    this.currentIndex = (this.currentIndex + 1) % this.playerIndices.length;
    if (this.currentIndex === 0) this.turnCount += 1;
    bus.emit(EVENTS.TURN_CHANGED, { player: this.activePlayer });
  }
}
