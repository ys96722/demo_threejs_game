export interface GridCoord {
  col: number;
  row: number;
}

export enum TileState {
  Default         = 'default',
  Hover           = 'hover',
  Selected        = 'selected',
  Occupied        = 'occupied',
  Reachable       = 'reachable',
  AttackRange     = 'attackrange',
  ReachableAttack = 'reachableattack',
}
