import { bus } from '../core/EventBus';
import { EVENTS } from '../types/events';
import type { Grid } from '../world/Grid';
import type { Character } from '../entities/Character';
import type { GridCoord } from '../types/grid';

export class MovementSystem {
  private grid: Grid;
  private character: Character;

  constructor(grid: Grid, character: Character) {
    this.grid = grid;
    this.character = character;

    bus.on(EVENTS.TILE_CLICKED, this.handleTileClicked);
  }

  dispose(): void {
    bus.off(EVENTS.TILE_CLICKED, this.handleTileClicked);
  }

  private handleTileClicked = ({ coord }: { coord: GridCoord }): void => {
    if (!this.grid.isValid(coord)) return;
    if (this.character.coord.col === coord.col && this.character.coord.row === coord.row) return;

    const from = this.character.coord;
    this.character.moveTo(coord);
    bus.emit(EVENTS.CHARACTER_MOVE_START, { from, to: coord });
  }
}
