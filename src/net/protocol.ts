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
  | { type: 'MOVE';         payload: { characterIndex: number; from: GridCoord; to: GridCoord } }
  | { type: 'ATTACK';       payload: { attackerIndex: number; targetCoord: GridCoord } }
  | { type: 'SKILL';        payload: { casterIndex: number; skillName: string; targetCoord: GridCoord } }
  | { type: 'SPEND_ACTION'; payload: { playerIndex: number } }
  | { type: 'CHAT';         payload: { text: string } };

// ---------------------------------------------------------------------------
// Server → Client messages
// ---------------------------------------------------------------------------

export type ServerMessage =
  | { type: 'GAME_START';            payload: { localTeam: number; initialState: GameStateSnapshot } }
  | { type: 'STATE_UPDATE';          payload: GameStateSnapshot }
  | { type: 'TURN_CHANGED';          payload: { activeTeam: number; turnCount: number } }
  | { type: 'ACTION_REJECTED';       payload: { reason: string } }
  | { type: 'GAME_OVER';             payload: { winnerTeam: number } }
  | { type: 'OPPONENT_DISCONNECTED'; payload: Record<string, never> }
  | { type: 'CHAT';                  payload: { team: number; text: string } };
