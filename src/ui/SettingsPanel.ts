import { bus } from '../core/EventBus';
import { EVENTS } from '../types/events';
import { THEMES, type ThemeId } from '../theme/themes';
import { getMasterVolume, setMasterVolume } from '../audio/MusicPlayer';

const STORAGE_KEY = 'srpg-theme';

export class SettingsPanel {
  private gear: HTMLButtonElement;
  private panel: HTMLDivElement;
  private activeId: ThemeId;
  private open = false;

  constructor() {
    this.activeId = (localStorage.getItem(STORAGE_KEY) as ThemeId | null) ?? 'VOID';

    // ── Gear button ──────────────────────────────────────────────────────────
    this.gear = document.createElement('button');
    this.gear.textContent = '⚙';
    this.gear.title = 'Settings';
    Object.assign(this.gear.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: '610',
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      border: '1px solid var(--theme-input-border)',
      background: 'var(--theme-panel-bg)',
      color: 'var(--theme-text)',
      fontSize: '18px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
    });
    this.gear.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // ── Dropdown panel ───────────────────────────────────────────────────────
    this.panel = document.createElement('div');
    Object.assign(this.panel.style, {
      position: 'fixed',
      top: '60px',
      right: '16px',
      zIndex: '610',
      background: 'var(--theme-panel-bg)',
      border: '1px solid var(--theme-input-border)',
      borderRadius: '10px',
      padding: '14px 16px',
      display: 'none',
      flexDirection: 'column',
      gap: '14px',
      minWidth: '220px',
    });

    this.panel.appendChild(this.buildVolumeRow());
    this.panel.appendChild(this.buildThemeRow());

    document.body.appendChild(this.gear);
    document.body.appendChild(this.panel);

    // Close panel on outside click
    document.addEventListener('click', (e) => {
      if (this.open && !this.panel.contains(e.target as Node) && e.target !== this.gear) {
        this.close();
      }
    });

    // Apply saved theme on load (no bus emit — Three.js scene not ready yet)
    this.applyTheme(this.activeId, false);
  }

  private buildVolumeRow(): HTMLDivElement {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '10px' });

    const label = document.createElement('span');
    label.textContent = 'Volume';
    Object.assign(label.style, { color: 'var(--theme-text)', fontSize: '13px', whiteSpace: 'nowrap' });

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(getMasterVolume() * 100));
    Object.assign(slider.style, { flex: '1', cursor: 'pointer', accentColor: 'var(--theme-accent)' });

    slider.addEventListener('input', () => {
      setMasterVolume(Number(slider.value) / 100);
    });

    row.appendChild(label);
    row.appendChild(slider);
    return row;
  }

  private buildThemeRow(): HTMLDivElement {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '10px' });

    const label = document.createElement('span');
    label.textContent = 'Theme';
    Object.assign(label.style, { color: 'var(--theme-text)', fontSize: '13px', whiteSpace: 'nowrap' });

    const swatches = document.createElement('div');
    Object.assign(swatches.style, { display: 'flex', gap: '8px' });

    for (const theme of Object.values(THEMES)) {
      const btn = document.createElement('button');
      btn.dataset['themeId'] = theme.id;
      btn.title = theme.label;
      Object.assign(btn.style, {
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        border: 'none',
        background: theme.swatch,
        cursor: 'pointer',
        padding: '0',
        flexShrink: '0',
      });
      btn.addEventListener('click', () => {
        this.applyTheme(theme.id);
        bus.emit(EVENTS.THEME_CHANGED, { themeId: theme.id });
      });
      swatches.appendChild(btn);
    }

    row.appendChild(label);
    row.appendChild(swatches);

    // Store swatches container ref for outline updates
    this._swatchesContainer = swatches;
    return row;
  }

  private _swatchesContainer: HTMLDivElement | null = null;

  private applyTheme(id: ThemeId, save = true): void {
    this.activeId = id;
    if (save) localStorage.setItem(STORAGE_KEY, id);

    const theme = THEMES[id];
    const root = document.documentElement;
    for (const [prop, value] of Object.entries(theme.css)) {
      root.style.setProperty(prop, value);
    }

    if (this._swatchesContainer) {
      for (const btn of this._swatchesContainer.querySelectorAll('button')) {
        const b = btn as HTMLButtonElement;
        const btnId = b.dataset['themeId'] as ThemeId;
        b.style.outline = btnId === id ? '3px solid var(--theme-accent)' : 'none';
        b.style.outlineOffset = '2px';
      }
    }
  }

  private toggle(): void {
    this.open ? this.close() : this.openPanel();
  }

  private openPanel(): void {
    this.open = true;
    this.panel.style.display = 'flex';
  }

  private close(): void {
    this.open = false;
    this.panel.style.display = 'none';
  }
}
