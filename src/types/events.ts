import type { GridCoord } from './grid';
import type { EffectPreview } from './characters';

export const EVENTS = {
  TILE_HOVER_ENTER: 'TILE_HOVER_ENTER',
  TILE_HOVER_EXIT: 'TILE_HOVER_EXIT',
  TILE_CLICKED: 'TILE_CLICKED',
  CHARACTER_MOVE_START: 'CHARACTER_MOVE_START',
  CHARACTER_MOVE_END: 'CHARACTER_MOVE_END',
  RENDERER_RESIZED: 'RENDERER_RESIZED',
  TURN_CHANGED: 'TURN_CHANGED',
  CHARACTER_SELECTED:          'CHARACTER_SELECTED',
  CHARACTER_DESELECTED:        'CHARACTER_DESELECTED',
  ACTION_USED:                 'ACTION_USED',
  ATTACK_TARGETING_START:      'ATTACK_TARGETING_START',
  ATTACK_TARGETING_CANCELLED:  'ATTACK_TARGETING_CANCELLED',
  CANVAS_CLICKED_EMPTY:        'canvas_clicked_empty',
  RANGE_PREVIEW_START:         'range_preview_start',
  RANGE_PREVIEW_END:           'range_preview_end',
  SKILL_TARGETING_START:       'skill_targeting_start',
  SKILL_TARGETING_CANCELLED:   'skill_targeting_cancelled',
  SKILL_HIT:                   'skill_hit',
  TARGET_PREVIEW_START:        'target_preview_start',
  TARGET_PREVIEW_END:          'target_preview_end',
} as const;

export type EventPayloads = {
  [EVENTS.TILE_HOVER_ENTER]: { coord: GridCoord };
  [EVENTS.TILE_HOVER_EXIT]: { coord: GridCoord };
  [EVENTS.TILE_CLICKED]: { coord: GridCoord };
  [EVENTS.CHARACTER_MOVE_START]: { from: GridCoord; to: GridCoord };
  [EVENTS.CHARACTER_MOVE_END]: { coord: GridCoord };
  [EVENTS.RENDERER_RESIZED]: { width: number; height: number };
  [EVENTS.TURN_CHANGED]: { player: number };
  [EVENTS.CHARACTER_SELECTED]: { playerIndex: number; coord: GridCoord };
  [EVENTS.CHARACTER_DESELECTED]: { playerIndex: number };
  [EVENTS.ACTION_USED]: { playerIndex: number };
  [EVENTS.ATTACK_TARGETING_START]: { playerIndex: number };
  [EVENTS.ATTACK_TARGETING_CANCELLED]: { playerIndex: number };
  [EVENTS.CANVAS_CLICKED_EMPTY]: Record<string, never>;
  [EVENTS.RANGE_PREVIEW_START]: { playerIndex: number; range: number };
  [EVENTS.RANGE_PREVIEW_END]: Record<string, never>;
  [EVENTS.SKILL_TARGETING_START]: { playerIndex: number; range: number };
  [EVENTS.SKILL_TARGETING_CANCELLED]: { playerIndex: number };
  [EVENTS.SKILL_HIT]: { casterIndex: number; skillName: string; targetCoord: GridCoord };
  [EVENTS.TARGET_PREVIEW_START]: { targetPlayerIndex: number; preview: EffectPreview };
  [EVENTS.TARGET_PREVIEW_END]: { targetPlayerIndex: number };
};

export type EventName = keyof EventPayloads;
