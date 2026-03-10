import type { GridCoord } from '../types/grid';

export function isValidCoord(coord: GridCoord, cols: number, rows: number): boolean {
  return coord.col >= 0 && coord.col < cols && coord.row >= 0 && coord.row < rows;
}

export function manhattanDist(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}
