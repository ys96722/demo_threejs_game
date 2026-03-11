import { bus } from '../core/EventBus';
import { EVENTS } from '../types/events';
import { THEMES, type ThemeId } from './themes';

const STORAGE_KEY = 'srpg-theme';

export class ThemeSwitcher {
  private container: HTMLDivElement;
  private activeId: ThemeId;

  constructor() {
    this.activeId = (localStorage.getItem(STORAGE_KEY) as ThemeId | null) ?? 'VOID';

    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: '600',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    for (const theme of Object.values(THEMES)) {
      const btn = document.createElement('button');
      btn.dataset['themeId'] = theme.id;
      btn.title = theme.label;
      Object.assign(btn.style, {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: 'none',
        background: theme.swatch,
        cursor: 'pointer',
        padding: '0',
      });
      btn.addEventListener('click', () => {
        this.applyTheme(theme.id);
        bus.emit(EVENTS.THEME_CHANGED, { themeId: theme.id });
      });
      this.container.appendChild(btn);
    }

    document.body.appendChild(this.container);

    // Apply saved theme without emitting bus event (Three.js consumers don't exist yet)
    this.applyTheme(this.activeId, false);
  }

  private applyTheme(id: ThemeId, save = true): void {
    this.activeId = id;
    if (save) localStorage.setItem(STORAGE_KEY, id);

    const theme = THEMES[id];
    const root = document.documentElement;
    for (const [prop, value] of Object.entries(theme.css)) {
      root.style.setProperty(prop, value);
    }

    // Update swatch outlines
    for (const btn of this.container.querySelectorAll('button')) {
      const btnId = (btn as HTMLButtonElement).dataset['themeId'] as ThemeId;
      (btn as HTMLButtonElement).style.outline =
        btnId === id ? '3px solid var(--theme-accent)' : 'none';
      (btn as HTMLButtonElement).style.outlineOffset = '2px';
    }
  }

  dispose(): void {
    this.container.remove();
  }
}
