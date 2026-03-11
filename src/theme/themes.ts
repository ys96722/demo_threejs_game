import { TileState } from '../types/grid';

export interface CssVars {
  '--theme-body-bg': string;
  '--theme-lobby-bg': string;
  '--theme-panel-bg': string;
  '--theme-btn-bg': string;
  '--theme-btn-color': string;
  '--theme-text': string;
  '--theme-input-bg': string;
  '--theme-input-border': string;
  '--theme-accent': string;
}

export interface TileColors {
  light: Record<TileState, number>;
  dark: Partial<Record<TileState, number>>;
}

export interface Theme {
  id: ThemeId;
  label: string;
  swatch: string;
  css: CssVars;
  scene: {
    background: number;
    fogColor: number;
    ambientIntensity: number;
    dirLightIntensity: number;
  };
  tiles: TileColors;
  glow: { r: number; g: number; b: number };
}

export type ThemeId = 'VOID' | 'EMBER' | 'SPECTER';

const VOID: Theme = {
  id: 'VOID',
  label: 'Void',
  swatch: '#4a90d9',
  css: {
    '--theme-body-bg': '#0d1117',
    '--theme-lobby-bg': '#030712',
    '--theme-panel-bg': 'rgba(6,12,22,0.82)',
    '--theme-btn-bg': 'rgba(74,144,217,0.18)',
    '--theme-btn-color': '#e2eaf4',
    '--theme-text': '#c9d8f0',
    '--theme-input-bg': '#0a0f1a',
    '--theme-input-border': '#1e3a5f',
    '--theme-accent': '#4a90d9',
  },
  scene: {
    background: 0x030712,
    fogColor: 0x030712,
    ambientIntensity: 0.35,
    dirLightIntensity: 1.1,
  },
  tiles: {
    light: {
      [TileState.Default]:         0x2d3f5c,
      [TileState.Hover]:           0x4a90d9,
      [TileState.Selected]:        0xf08844,
      [TileState.Occupied]:        0x3b6fa0,
      [TileState.Reachable]:       0x2d6e3e,
      [TileState.AttackRange]:     0x1a3a6e,
      [TileState.ReachableAttack]: 0x2d5e6e,
    },
    dark: {
      [TileState.Default]: 0x1a2638,
    },
  },
  glow: { r: 1.8, g: 1.4, b: 0.6 },
};

const EMBER: Theme = {
  id: 'EMBER',
  label: 'Ember',
  swatch: '#d97706',
  css: {
    '--theme-body-bg': '#1a0c00',
    '--theme-lobby-bg': '#120800',
    '--theme-panel-bg': 'rgba(40,12,0,0.82)',
    '--theme-btn-bg': 'rgba(217,119,6,0.22)',
    '--theme-btn-color': '#fde8c8',
    '--theme-text': '#fde8c8',
    '--theme-input-bg': '#1a0800',
    '--theme-input-border': '#5c2800',
    '--theme-accent': '#d97706',
  },
  scene: {
    background: 0x120500,
    fogColor: 0x120500,
    ambientIntensity: 0.55,
    dirLightIntensity: 1.4,
  },
  tiles: {
    light: {
      [TileState.Default]:         0x5c3020,
      [TileState.Hover]:           0xd97706,
      [TileState.Selected]:        0xef4444,
      [TileState.Occupied]:        0x7c4a20,
      [TileState.Reachable]:       0x6e4a1a,
      [TileState.AttackRange]:     0x6e2010,
      [TileState.ReachableAttack]: 0x6e3818,
    },
    dark: {
      [TileState.Default]: 0x381808,
    },
  },
  glow: { r: 2.2, g: 1.0, b: 0.3 },
};

const SPECTER: Theme = {
  id: 'SPECTER',
  label: 'Specter',
  swatch: '#c026d3',
  css: {
    '--theme-body-bg': '#0a000f',
    '--theme-lobby-bg': '#06000c',
    '--theme-panel-bg': 'rgba(20,0,30,0.88)',
    '--theme-btn-bg': 'rgba(192,38,211,0.18)',
    '--theme-btn-color': '#e8b4ff',
    '--theme-text': '#e8b4ff',
    '--theme-input-bg': '#0a0010',
    '--theme-input-border': '#4a0060',
    '--theme-accent': '#c026d3',
  },
  scene: {
    background: 0x06000c,
    fogColor: 0x06000c,
    ambientIntensity: 0.20,
    dirLightIntensity: 0.85,
  },
  tiles: {
    light: {
      [TileState.Default]:         0x2d1040,
      [TileState.Hover]:           0xc026d3,
      [TileState.Selected]:        0xf43f5e,
      [TileState.Occupied]:        0x4a1070,
      [TileState.Reachable]:       0x3b0e5a,
      [TileState.AttackRange]:     0x4a0060,
      [TileState.ReachableAttack]: 0x4a0e68,
    },
    dark: {
      [TileState.Default]: 0x1a0028,
    },
  },
  glow: { r: 1.6, g: 0.3, b: 2.4 },
};

export const THEMES: Record<ThemeId, Theme> = { VOID, EMBER, SPECTER };
