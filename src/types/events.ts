import type { GridCoord } from './grid';

export const EVENTS = {
  TILE_HOVER_ENTER: 'TILE_HOVER_ENTER',
  TILE_HOVER_EXIT: 'TILE_HOVER_EXIT',
  TILE_CLICKED: 'TILE_CLICKED',
  CHARACTER_MOVE_START: 'CHARACTER_MOVE_START',
  CHARACTER_MOVE_END: 'CHARACTER_MOVE_END',
  RENDERER_RESIZED: 'RENDERER_RESIZED',
  TURN_CHANGED: 'TURN_CHANGED',
} as const;

export type EventPayloads = {
  [EVENTS.TILE_HOVER_ENTER]: { coord: GridCoord };
  [EVENTS.TILE_HOVER_EXIT]: { coord: GridCoord };
  [EVENTS.TILE_CLICKED]: { coord: GridCoord };
  [EVENTS.CHARACTER_MOVE_START]: { from: GridCoord; to: GridCoord };
  [EVENTS.CHARACTER_MOVE_END]: { coord: GridCoord };
  [EVENTS.RENDERER_RESIZED]: { width: number; height: number };
  [EVENTS.TURN_CHANGED]: { player: number };
};

export type EventName = keyof EventPayloads;
