import { describe, it, expect } from 'vitest';
import { computeDisplaceDir, validateDisplace } from '../combat';

const enemy = (col: number, row: number) => ({ coord: { col, row }, team: 1 });
const ally  = (col: number, row: number) => ({ coord: { col, row }, team: 0 });
const caster = (col: number, row: number) => ({ coord: { col, row }, team: 0 });

describe('computeDisplaceDir', () => {
  it('pushes enemy to the right (caster left of target)', () => {
    const { dc, dr } = computeDisplaceDir(caster(2, 5), enemy(5, 5));
    expect(dc).toBe(1);
    expect(dr).toBe(0);
  });

  it('pushes enemy to the left (caster right of target)', () => {
    const { dc, dr } = computeDisplaceDir(caster(8, 5), enemy(5, 5));
    expect(dc).toBe(-1);
    expect(dr).toBe(0);
  });

  it('pushes enemy upward (caster below target in row)', () => {
    const { dc, dr } = computeDisplaceDir(caster(5, 8), enemy(5, 5));
    expect(dc).toBe(0);
    expect(dr).toBe(-1);
  });

  it('pulls ally toward caster (ally to the right → pulled left)', () => {
    // ally is at col 7, caster at col 3 → ally moves toward caster (dc = -1)
    const { dc, dr } = computeDisplaceDir(caster(3, 5), ally(7, 5));
    expect(dc).toBe(-1);
    expect(dr).toBe(0);
  });

  it('handles diagonal positions (both col and row differ)', () => {
    const { dc, dr } = computeDisplaceDir(caster(2, 2), enemy(5, 4));
    expect(dc).toBe(1);
    expect(dr).toBe(1);
  });
});

describe('validateDisplace', () => {
  const gridIsValid = (coord: { col: number; row: number }) =>
    coord.col >= 0 && coord.col < 10 && coord.row >= 0 && coord.row < 10;

  it('allows valid push into empty tile', () => {
    const occupied = () => false;
    expect(validateDisplace(caster(3, 5), enemy(6, 5), gridIsValid, occupied)).toBe(true);
  });

  it('blocks push when destination is off-grid (enemy at right edge)', () => {
    const occupied = () => false;
    // caster at col 3, enemy at col 9 → push destination col 10 (off grid)
    expect(validateDisplace(caster(3, 5), enemy(9, 5), gridIsValid, occupied)).toBe(false);
  });

  it('blocks push when destination is occupied', () => {
    const occupied = (coord: { col: number; row: number }) => coord.col === 7 && coord.row === 5;
    expect(validateDisplace(caster(3, 5), enemy(6, 5), gridIsValid, occupied)).toBe(false);
  });

  it('blocks pull when destination tile is occupied', () => {
    // ally at col 7, caster at col 3 → pull dest is col 6
    const occupied = (coord: { col: number; row: number }) => coord.col === 6 && coord.row === 5;
    expect(validateDisplace(caster(3, 5), ally(7, 5), gridIsValid, occupied)).toBe(false);
  });

  it('allows pull with empty pull destination', () => {
    const occupied = () => false;
    // ally at col 7, caster at col 3 → pull dest col 6, which is empty
    expect(validateDisplace(caster(3, 5), ally(7, 5), gridIsValid, occupied)).toBe(true);
  });

  it('blocks push when enemy is at top edge (row 0)', () => {
    const occupied = () => false;
    // caster at row 5, enemy at row 0 → push dest row -1 (off grid)
    expect(validateDisplace(caster(5, 5), enemy(5, 0), gridIsValid, occupied)).toBe(false);
  });

  it('allows pull when ally is at grid edge (pull moves toward caster, not off-grid)', () => {
    const occupied = () => false;
    // ally at col 9 (right edge), caster at col 3 → pull dc = sign(3-9) = -1 → dest col 8 (valid)
    expect(validateDisplace(caster(3, 5), ally(9, 5), gridIsValid, occupied)).toBe(true);
  });
});
