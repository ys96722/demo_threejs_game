import { describe, it, expect } from 'vitest';
import { isValidCoord, manhattanDist } from '../grid';

describe('isValidCoord', () => {
  it('accepts interior tiles', () => {
    expect(isValidCoord({ col: 5, row: 5 }, 10, 10)).toBe(true);
  });

  it('accepts corner tile (0,0)', () => {
    expect(isValidCoord({ col: 0, row: 0 }, 10, 10)).toBe(true);
  });

  it('accepts corner tile (9,9) on a 10x10 grid', () => {
    expect(isValidCoord({ col: 9, row: 9 }, 10, 10)).toBe(true);
  });

  it('rejects col=-1', () => {
    expect(isValidCoord({ col: -1, row: 0 }, 10, 10)).toBe(false);
  });

  it('rejects col=10 on 10-wide grid', () => {
    expect(isValidCoord({ col: 10, row: 0 }, 10, 10)).toBe(false);
  });

  it('rejects row=-1', () => {
    expect(isValidCoord({ col: 0, row: -1 }, 10, 10)).toBe(false);
  });

  it('rejects row=10 on 10-tall grid', () => {
    expect(isValidCoord({ col: 0, row: 10 }, 10, 10)).toBe(false);
  });
});

describe('manhattanDist', () => {
  it('returns 0 for same tile', () => {
    expect(manhattanDist({ col: 3, row: 3 }, { col: 3, row: 3 })).toBe(0);
  });

  it('returns correct horizontal distance', () => {
    expect(manhattanDist({ col: 0, row: 0 }, { col: 4, row: 0 })).toBe(4);
  });

  it('returns correct vertical distance', () => {
    expect(manhattanDist({ col: 0, row: 0 }, { col: 0, row: 3 })).toBe(3);
  });

  it('returns correct diagonal distance (sum of both axes)', () => {
    expect(manhattanDist({ col: 0, row: 0 }, { col: 3, row: 4 })).toBe(7);
  });
});
