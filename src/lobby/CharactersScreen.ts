import { API_BASE } from '../config/env';
import { characters as allCharacters } from '../config/gameConfig';

interface CharacterEntry {
  id: number;
  name: string;
}

export class CharactersScreen {
  private container: HTMLDivElement;

  constructor(private onBack: () => void) {
    this.container = document.createElement('div');
    this.container.className = 'at-screen at-characters-screen';
    document.body.appendChild(this.container);
    this.renderLoading();
    void this.load();
  }

  dispose(): void {
    this.container.remove();
  }

  private renderLoading(): void {
    this.container.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'at-status-text';
    p.textContent = 'Loading characters…';
    this.container.appendChild(p);
  }

  private renderError(): void {
    this.container.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'at-error';
    p.textContent = 'Could not load characters.';
    this.container.appendChild(p);
    this.appendBackButton();
  }

  private render(characters: CharacterEntry[]): void {
    this.container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'at-store-header';
    const title = document.createElement('h1');
    title.textContent = 'Characters';
    title.className = 'at-section-title';
    header.appendChild(title);
    this.container.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'at-characters-grid';

    for (const [i, char] of characters.entries()) {
      const sprite = allCharacters.find(c => c.name === char.name)?.spritePath ?? '';

      const card = document.createElement('div');
      card.className = 'at-champion-card';
      card.style.animationDelay = `${i * 0.07}s`;

      const imageArea = document.createElement('div');
      imageArea.className = 'at-champion-card__image-area';
      if (sprite) {
        const img = document.createElement('img');
        img.src = sprite;
        img.alt = char.name;
        imageArea.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'at-characters-card__placeholder';
        placeholder.textContent = char.name[0] ?? '?';
        imageArea.appendChild(placeholder);
      }

      const infoArea = document.createElement('div');
      infoArea.className = 'at-champion-card__info-area';
      const nameEl = document.createElement('p');
      nameEl.className = 'at-champion-card__name';
      nameEl.textContent = char.name;
      infoArea.appendChild(nameEl);

      card.appendChild(imageArea);
      card.appendChild(infoArea);
      grid.appendChild(card);
    }

    this.container.appendChild(grid);
    this.appendBackButton();
  }

  private appendBackButton(): void {
    const back = document.createElement('button');
    back.textContent = '← Back';
    back.className = 'at-btn at-btn-stagger';
    back.style.marginTop = '28px';
    back.addEventListener('click', () => this.onBack());
    this.container.appendChild(back);
  }

  private async load(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/users/1/characters`);
      if (!res.ok) { this.renderError(); return; }
      const data = await res.json() as { characters: CharacterEntry[] };
      this.render(data.characters);
    } catch {
      this.renderError();
    }
  }
}
