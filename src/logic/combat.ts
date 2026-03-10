import type { GridCoord } from '../types/grid';

export interface HasStrengthDefense {
  strength: number;
  defense: number;
}

export interface HasCoordTeam {
  coord: GridCoord;
  team: number;
}

export function computeAttackDamage(attacker: HasStrengthDefense, target: HasStrengthDefense): number {
  return Math.max(0, attacker.strength - target.defense);
}

export function computeDisplaceDir(
  mover: HasCoordTeam,
  target: HasCoordTeam,
): { dc: number; dr: number } {
  const isEnemy = target.team !== mover.team;
  return {
    dc: isEnemy
      ? Math.sign(target.coord.col - mover.coord.col)
      : Math.sign(mover.coord.col - target.coord.col),
    dr: isEnemy
      ? Math.sign(target.coord.row - mover.coord.row)
      : Math.sign(mover.coord.row - target.coord.row),
  };
}

export function validateDisplace(
  caster: HasCoordTeam,
  target: HasCoordTeam,
  gridIsValid: (coord: GridCoord) => boolean,
  occupied: (coord: GridCoord) => boolean,
): boolean {
  const { dc, dr } = computeDisplaceDir(caster, target);
  const dest = { col: target.coord.col + dc, row: target.coord.row + dr };
  return gridIsValid(dest) && !occupied(dest);
}
