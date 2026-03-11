import type { CharacterConfig } from '../types/characters';

export type BoardType = 'tactical' | 'go';

export type GameMode =
  | { kind: 'solo'; selections: Record<number, number>; board: BoardType }
  | { kind: 'pvp'; localTeam: number; ws: WebSocket; selections: Record<number, number>; roster: CharacterConfig[]; board: BoardType };
