export type GameMode =
  | { kind: 'solo' }
  | { kind: 'pvp'; localTeam: number; ws: WebSocket };
