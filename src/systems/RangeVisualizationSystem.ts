import { bus } from '../core/EventBus';
import { EVENTS } from '../types/events';
import type { Character } from '../entities/Character';
import type { Grid } from '../world/Grid';
import { TileState } from '../types/grid';
import type { GridCoord } from '../types/grid';

export class RangeVisualizationSystem {
  private reachableCoords = new Set<string>();
  private attackRangeCoords = new Set<string>();
  private hoveredCoord: GridCoord | null = null;

  constructor(
    private grid: Grid,
    private getChar: (idx: number) => Character | undefined,
  ) {
    bus.on(EVENTS.TILE_HOVER_ENTER, this.handleHoverEnter);
    bus.on(EVENTS.TILE_HOVER_EXIT, this.handleHoverExit);
    bus.on(EVENTS.CHARACTER_SELECTED, this.handleCharacterSelected);
    bus.on(EVENTS.CHARACTER_DESELECTED, this.handleCharacterDeselected);
    bus.on(EVENTS.ATTACK_TARGETING_START, this.handleAttackTargetingStart);
    bus.on(EVENTS.ATTACK_TARGETING_CANCELLED, this.handleAttackTargetingCancelled);
    bus.on(EVENTS.CHARACTER_MOVE_START, this.handleMoveStart);
    bus.on(EVENTS.RANGE_PREVIEW_START, this.handleRangePreviewStart);
    bus.on(EVENTS.RANGE_PREVIEW_END, this.handleRangePreviewEnd);
    bus.on(EVENTS.SKILL_TARGETING_START, this.handleSkillTargetingStart);
    bus.on(EVENTS.SKILL_TARGETING_CANCELLED, this.handleSkillTargetingCancelled);
  }

  isReachable(coord: GridCoord): boolean {
    return this.reachableCoords.has(`${coord.col},${coord.row}`);
  }

  private showReachable(char: Character): void {
    this.clearReachable();
    for (const tile of this.grid.allTiles()) {
      const { col, row } = tile.coord;
      const dist = Math.abs(col - char.coord.col) + Math.abs(row - char.coord.row);
      if (dist > 0 && dist <= char.moveRange && tile.state !== TileState.Occupied) {
        tile.setState(TileState.Reachable);
        this.reachableCoords.add(`${col},${row}`);
      }
    }
  }

  private clearReachable(): void {
    for (const key of this.reachableCoords) {
      const [col, row] = key.split(',').map(Number);
      const tile = this.grid.getTile({ col, row });
      if (!tile) continue;
      if (tile.state === TileState.Reachable) tile.setState(TileState.Default);
      else if (tile.state === TileState.ReachableAttack) tile.setState(TileState.AttackRange);
    }
    this.reachableCoords.clear();
  }

  private showAttackRange(char: Character, range?: number): void {
    this.clearAttackRange();
    const r = range ?? char.attackRange;
    for (const tile of this.grid.allTiles()) {
      const { col, row } = tile.coord;
      const dist = Math.abs(col - char.coord.col) + Math.abs(row - char.coord.row);
      if (dist < 1 || dist > r) continue;
      this.attackRangeCoords.add(`${col},${row}`);
      if (tile.state === TileState.Reachable) tile.setState(TileState.ReachableAttack);
      else if (tile.state !== TileState.Occupied) tile.setState(TileState.AttackRange);
    }
  }

  private clearAttackRange(): void {
    for (const key of this.attackRangeCoords) {
      const [col, row] = key.split(',').map(Number);
      const tile = this.grid.getTile({ col, row });
      if (!tile) continue;
      if (tile.state === TileState.AttackRange) tile.setState(TileState.Default);
      else if (tile.state === TileState.ReachableAttack) tile.setState(TileState.Reachable);
    }
    this.attackRangeCoords.clear();
  }

  restoreState(coord: GridCoord): TileState {
    const key = `${coord.col},${coord.row}`;
    const inMove = this.reachableCoords.has(key);
    const inAttack = this.attackRangeCoords.has(key);
    if (inMove && inAttack) return TileState.ReachableAttack;
    if (inMove) return TileState.Reachable;
    if (inAttack) return TileState.AttackRange;
    return TileState.Default;
  }

  private handleHoverEnter = ({ coord }: { coord: GridCoord }): void => {
    if (this.hoveredCoord) {
      const prev = this.grid.getTile(this.hoveredCoord);
      if (prev && prev.state === TileState.Hover) {
        prev.setState(this.restoreState(this.hoveredCoord));
      }
    }
    this.hoveredCoord = coord;
    const tile = this.grid.getTile(coord);
    if (tile && (
      tile.state === TileState.Default ||
      tile.state === TileState.Reachable ||
      tile.state === TileState.AttackRange ||
      tile.state === TileState.ReachableAttack
    )) {
      tile.setState(TileState.Hover);
    }
  };

  private handleHoverExit = ({ coord }: { coord: GridCoord }): void => {
    const tile = this.grid.getTile(coord);
    if (tile && tile.state === TileState.Hover) {
      tile.setState(this.restoreState(coord));
    }
    if (this.hoveredCoord?.col === coord.col && this.hoveredCoord?.row === coord.row) {
      this.hoveredCoord = null;
    }
  };

  private handleCharacterSelected = ({ playerIndex }: { playerIndex: number }): void => {
    const char = this.getChar(playerIndex);
    if (!char) return;
    if (char.moveTokens > 0) this.showReachable(char);
  };

  private handleCharacterDeselected = (): void => {
    this.clearReachable();
    this.clearAttackRange();
  };

  private handleAttackTargetingStart = ({ playerIndex }: { playerIndex: number }): void => {
    const char = this.getChar(playerIndex);
    if (!char) return;
    this.clearReachable();
    this.showAttackRange(char);
  };

  private handleAttackTargetingCancelled = ({ playerIndex }: { playerIndex: number }): void => {
    this.clearAttackRange();
    const char = this.getChar(playerIndex);
    if (char && char.moveTokens > 0) this.showReachable(char);
  };

  private handleMoveStart = (): void => {
    this.clearReachable();
    this.clearAttackRange();
  };

  private handleRangePreviewStart = ({ playerIndex, range }: { playerIndex: number; range: number }): void => {
    const char = this.getChar(playerIndex);
    if (!char) return;
    this.showAttackRange(char, range);
  };

  private handleRangePreviewEnd = (): void => {
    this.clearAttackRange();
  };

  private handleSkillTargetingStart = ({ playerIndex, range }: { playerIndex: number; range: number }): void => {
    const char = this.getChar(playerIndex);
    if (!char) return;
    this.clearReachable();
    this.showAttackRange(char, range);
  };

  private handleSkillTargetingCancelled = ({ playerIndex }: { playerIndex: number }): void => {
    this.clearAttackRange();
    const char = this.getChar(playerIndex);
    if (char && char.moveTokens > 0) this.showReachable(char);
  };

  dispose(): void {
    bus.off(EVENTS.TILE_HOVER_ENTER, this.handleHoverEnter);
    bus.off(EVENTS.TILE_HOVER_EXIT, this.handleHoverExit);
    bus.off(EVENTS.CHARACTER_SELECTED, this.handleCharacterSelected);
    bus.off(EVENTS.CHARACTER_DESELECTED, this.handleCharacterDeselected);
    bus.off(EVENTS.ATTACK_TARGETING_START, this.handleAttackTargetingStart);
    bus.off(EVENTS.ATTACK_TARGETING_CANCELLED, this.handleAttackTargetingCancelled);
    bus.off(EVENTS.CHARACTER_MOVE_START, this.handleMoveStart);
    bus.off(EVENTS.RANGE_PREVIEW_START, this.handleRangePreviewStart);
    bus.off(EVENTS.RANGE_PREVIEW_END, this.handleRangePreviewEnd);
    bus.off(EVENTS.SKILL_TARGETING_START, this.handleSkillTargetingStart);
    bus.off(EVENTS.SKILL_TARGETING_CANCELLED, this.handleSkillTargetingCancelled);
  }
}
