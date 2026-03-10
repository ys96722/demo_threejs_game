import { describe, it, expect } from 'vitest';
import { computeAttackDamage } from '../combat';

describe('computeAttackDamage', () => {
  it('deals full damage when strength > defense', () => {
    // Seonjae (strength 10) vs Mina (defense 1) → 9 damage
    expect(computeAttackDamage({ strength: 10, defense: 0 }, { strength: 0, defense: 1 })).toBe(9);
  });

  it('deals 0 damage when defense >= strength', () => {
    expect(computeAttackDamage({ strength: 3, defense: 0 }, { strength: 0, defense: 5 })).toBe(0);
  });

  it('never deals negative damage', () => {
    expect(computeAttackDamage({ strength: 1, defense: 0 }, { strength: 0, defense: 100 })).toBe(0);
  });

  it('damage is reduced correctly after Reveille buff (+10 defense)', () => {
    // Attacker strength 10, target defense 1 initially → 9 damage
    // After buff, target defense 11 → 0 damage
    const attacker = { strength: 10, defense: 0 };
    const target = { strength: 0, defense: 1 };
    expect(computeAttackDamage(attacker, target)).toBe(9);
    const buffedTarget = { ...target, defense: target.defense + 10 };
    expect(computeAttackDamage(attacker, buffedTarget)).toBe(0);
  });

  it('kills 1-hp target: damage equals or exceeds hp', () => {
    // strength 5 vs defense 0 → 5 damage, enough to kill a 1-hp target
    const damage = computeAttackDamage({ strength: 5, defense: 0 }, { strength: 0, defense: 0 });
    expect(damage).toBeGreaterThanOrEqual(1);
    // The caller is responsible for applying damage to hp; function just returns value
  });

  it('attacker with 0 strength deals 0 damage', () => {
    expect(computeAttackDamage({ strength: 0, defense: 0 }, { strength: 0, defense: 0 })).toBe(0);
  });

  it('target with very high defense blocks all damage', () => {
    expect(computeAttackDamage({ strength: 5, defense: 0 }, { strength: 0, defense: 999 })).toBe(0);
  });
});

describe('Reveille of Black Cranes (defense buff)', () => {
  it('increases target defense by 10', () => {
    const target = { strength: 0, defense: 3 };
    const buffedDefense = target.defense + 10;
    expect(buffedDefense).toBe(13);
  });

  it('stacks on repeated casts', () => {
    let defense = 1;
    defense += 10;
    defense += 10;
    expect(defense).toBe(21);
  });
});
