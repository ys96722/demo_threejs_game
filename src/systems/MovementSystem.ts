import { bus } from '../core/EventBus';
import { EVENTS } from '../types/events';
import type { Grid } from '../world/Grid';
import type { Character } from '../entities/Character';
import type { GridCoord } from '../types/grid';

export class MovementSystem {
  private grid: Grid;
  private getSelectedCharacter: () => Character | null;
  private isOccupied: (coord: GridCoord) => boolean;

  constructor(
    grid: Grid,
    getSelectedCharacter: () => Character | null,
    isOccupied: (coord: GridCoord) => boolean
  ) {
    this.grid = grid;
    this.getSelectedCharacter = getSelectedCharacter;
    this.isOccupied = isOccupied;

    bus.on(EVENTS.TILE_CLICKED, this.handleTileClicked);
  }

  dispose(): void {
    bus.off(EVENTS.TILE_CLICKED, this.handleTileClicked);
  }

  private handleTileClicked = ({ coord }: { coord: GridCoord }): void => {
    const selected = this.getSelectedCharacter();
    if (!selected) return;
    if (selected.moveTokens === 0) return;
    const from = selected.coord;
    if (!this.grid.isValid(coord)) return;
    if (coord.col === from.col && coord.row === from.row) return;
    if (this.isOccupied(coord)) return;
    const dist = Math.abs(coord.col - from.col) + Math.abs(coord.row - from.row);
    if (dist > selected.moveRange) return;
    bus.emit(EVENTS.MOVE_INTENT, { characterIndex: selected.playerIndex, from, to: coord });
  };
}
