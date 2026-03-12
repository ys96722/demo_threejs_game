export const SKILL_NAMES = {
  REVEILLE: 'Reveille of Black Cranes',
  ABRAZO:   'Abrazo o Desprecio (Embrace or Exile)',
} as const;

export type SkillName = typeof SKILL_NAMES[keyof typeof SKILL_NAMES];
