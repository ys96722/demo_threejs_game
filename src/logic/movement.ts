import type { GridCoord } from '../types/grid';
import { manhattanDist } from './grid';

export interface HasCoordTokensRange {
  coord: GridCoord;
  moveRange: number;
  moveTokens: number;
}

export function validateMovement(
  char: HasCoordTokensRange,
  dest: GridCoord,
  gridIsValid: (coord: GridCoord) => boolean,
  occupied: (coord: GridCoord) => boolean,
): boolean {
  if (char.moveTokens === 0) return false;
  if (!gridIsValid(dest)) return false;
  if (dest.col === char.coord.col && dest.row === char.coord.row) return false;
  if (occupied(dest)) return false;
  return manhattanDist(char.coord, dest) <= char.moveRange;
}
