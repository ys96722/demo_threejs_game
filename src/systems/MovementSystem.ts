import { bus } from '../core/EventBus';
import { EVENTS } from '../types/events';
import type { Grid } from '../world/Grid';
import type { Character } from '../entities/Character';
import type { GridCoord } from '../types/grid';

export class MovementSystem {
  private grid: Grid;
  private getActiveCharacter: () => Character;
  private isOccupied: (coord: GridCoord) => boolean;

  constructor(
    grid: Grid,
    getActiveCharacter: () => Character,
    isOccupied: (coord: GridCoord) => boolean
  ) {
    this.grid = grid;
    this.getActiveCharacter = getActiveCharacter;
    this.isOccupied = isOccupied;

    bus.on(EVENTS.TILE_CLICKED, this.handleTileClicked);
  }

  dispose(): void {
    bus.off(EVENTS.TILE_CLICKED, this.handleTileClicked);
  }

  private handleTileClicked = ({ coord }: { coord: GridCoord }): void => {
    const activeChar = this.getActiveCharacter();
    const from = activeChar.coord;
    if (!this.grid.isValid(coord)) return;
    if (coord.col === from.col && coord.row === from.row) return;
    if (this.isOccupied(coord)) return;
    const dist = Math.abs(coord.col - from.col) + Math.abs(coord.row - from.row);
    if (dist > activeChar.moveRange) return;
    activeChar.moveTo(coord);
    bus.emit(EVENTS.CHARACTER_MOVE_START, { from, to: coord });
  };
}
