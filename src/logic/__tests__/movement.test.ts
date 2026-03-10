import { describe, it, expect } from 'vitest';
import { validateMovement } from '../movement';

const gridIsValid = (coord: { col: number; row: number }) =>
  coord.col >= 0 && coord.col < 10 && coord.row >= 0 && coord.row < 10;

const char = (col: number, row: number, moveRange = 3, moveTokens = 1) => ({
  coord: { col, row },
  moveRange,
  moveTokens,
});

describe('validateMovement', () => {
  it('allows move within range', () => {
    expect(validateMovement(char(5, 5), { col: 7, row: 5 }, gridIsValid, () => false)).toBe(true);
  });

  it('allows move at exact range boundary', () => {
    expect(validateMovement(char(5, 5, 3), { col: 8, row: 5 }, gridIsValid, () => false)).toBe(true);
  });

  it('blocks move beyond moveRange', () => {
    expect(validateMovement(char(5, 5, 3), { col: 9, row: 5 }, gridIsValid, () => false)).toBe(false);
  });

  it('blocks move when moveTokens = 0', () => {
    expect(validateMovement(char(5, 5, 3, 0), { col: 6, row: 5 }, gridIsValid, () => false)).toBe(false);
  });

  it('blocks move to own tile (no-op)', () => {
    expect(validateMovement(char(5, 5), { col: 5, row: 5 }, gridIsValid, () => false)).toBe(false);
  });

  it('blocks move onto occupied tile (enemy)', () => {
    const occupied = (c: { col: number; row: number }) => c.col === 7 && c.row === 5;
    expect(validateMovement(char(5, 5), { col: 7, row: 5 }, gridIsValid, occupied)).toBe(false);
  });

  it('blocks move onto occupied tile (ally)', () => {
    const occupied = (c: { col: number; row: number }) => c.col === 6 && c.row === 5;
    expect(validateMovement(char(5, 5), { col: 6, row: 5 }, gridIsValid, occupied)).toBe(false);
  });

  it('blocks move off-grid (col < 0)', () => {
    expect(validateMovement(char(0, 5), { col: -1, row: 5 }, gridIsValid, () => false)).toBe(false);
  });

  it('blocks move off-grid (row >= rows)', () => {
    expect(validateMovement(char(5, 9), { col: 5, row: 10 }, gridIsValid, () => false)).toBe(false);
  });

  it('blocks move off left edge (col < 0)', () => {
    expect(validateMovement(char(1, 5, 3), { col: -1, row: 5 }, gridIsValid, () => false)).toBe(false);
  });

  it('blocks move off right edge (col >= cols)', () => {
    expect(validateMovement(char(8, 5, 3), { col: 10, row: 5 }, gridIsValid, () => false)).toBe(false);
  });

  it('blocks move off top edge (row < 0)', () => {
    expect(validateMovement(char(5, 1, 3), { col: 5, row: -1 }, gridIsValid, () => false)).toBe(false);
  });

  it('blocks move off bottom edge (row >= rows)', () => {
    expect(validateMovement(char(5, 8, 3), { col: 5, row: 10 }, gridIsValid, () => false)).toBe(false);
  });
});
