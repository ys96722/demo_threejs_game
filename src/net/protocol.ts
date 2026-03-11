import type { GridCoord } from '../types/grid';

// ---------------------------------------------------------------------------
// Shared snapshot shape — mirrors CharacterState in the Python server
// ---------------------------------------------------------------------------

export interface CharacterSnapshot {
  playerIndex: number;
  team: number;
  coord: GridCoord;
  hp: number;
  defense: number;
  moveTokens: number;
  actionTokens: number;
}

export interface GameStateSnapshot {
  characters: CharacterSnapshot[];
  activeTeam: number;
  turnCount: number;
}

// ---------------------------------------------------------------------------
// Client → Server messages
// ---------------------------------------------------------------------------

export type ClientMessage =
  | { type: 'MOVE';              payload: { characterIndex: number; from: GridCoord; to: GridCoord } }
  | { type: 'ATTACK';            payload: { attackerIndex: number; targetCoord: GridCoord } }
  | { type: 'SKILL';             payload: { casterIndex: number; skillName: string; targetCoord: GridCoord } }
  | { type: 'SPEND_ACTION';      payload: { playerIndex: number } }
  | { type: 'CHAT';              payload: { text: string } }
  | { type: 'CHAMPION_SELECTED'; payload: { team: number; characterIndex: number; board: string } };

// ---------------------------------------------------------------------------
// Roster types (sent by server in CHAMPION_SELECTION_START)
// ---------------------------------------------------------------------------

export interface RosterSkill {
  name: string;
  range: number;
  targetType: 'enemy' | 'ally' | 'any';
}

export interface RosterEntry {
  playerIndex: number;
  name: string;
  hp: number;
  maxHp: number;
  strength: number;
  intellect: number;
  defense: number;
  resistance: number;
  moveRange: number;
  attackRange: number;
  skills: RosterSkill[];
}

// ---------------------------------------------------------------------------
// Server → Client messages
// ---------------------------------------------------------------------------

export type ServerMessage =
  | { type: 'GAME_START';               payload: { localTeam: number; initialState: GameStateSnapshot; selections: Record<number, number>; board: string } }
  | { type: 'CHAMPION_SELECTION_START'; payload: { characters: RosterEntry[] } }
  | { type: 'STATE_UPDATE';             payload: GameStateSnapshot }
  | { type: 'TURN_CHANGED';             payload: { activeTeam: number; turnCount: number } }
  | { type: 'ACTION_REJECTED';          payload: { reason: string } }
  | { type: 'GAME_OVER';                payload: { winnerTeam: number } }
  | { type: 'OPPONENT_DISCONNECTED';    payload: Record<string, never> }
  | { type: 'CHAT';                     payload: { team: number; text: string } };
