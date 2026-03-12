import { MusicPlayer, MUSIC_FILES } from '../audio/MusicPlayer';

const STORE_ITEMS = [
  { id: 1, tagline: "Watch your health, that's your wealth" },
  { id: 2, tagline: "Watch your brother, that's yourself" },
  { id: 3, tagline: "Watch your home, that's your door" },
  { id: 4, tagline: 'If they want it, we go to war' },
  { id: 5, tagline: 'Dance a little, sing a little' },
];

export class StoreScreen {
  private container: HTMLDivElement;
  private music = new MusicPlayer();

  constructor(private onBack: () => void) {
    this.container = document.createElement('div');
    this.container.className = 'at-screen at-store-screen';
    document.body.appendChild(this.container);
    this.music.play(MUSIC_FILES.STORE);
    this.render();
  }

  dispose(): void {
    this.music.dispose();
    this.container.remove();
  }

  private render(): void {
    // Title area
    const titleWrap = document.createElement('div');
    titleWrap.className = 'at-store-header';

    const title = document.createElement('h1');
    title.textContent = 'Store';
    title.className = 'at-section-title';
    titleWrap.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Items coming soon — check back later.';
    subtitle.className = 'at-store-subtitle';
    titleWrap.appendChild(subtitle);

    this.container.appendChild(titleWrap);

    // Item grid
    const grid = document.createElement('div');
    grid.className = 'at-store-grid';

    for (const item of STORE_ITEMS) {
      const card = document.createElement('div');
      card.className = 'at-store-item';

      const icon = document.createElement('div');
      icon.className = 'at-store-item__icon';
      icon.textContent = '✦';

      const body = document.createElement('div');
      body.className = 'at-store-item__body';

      const label = document.createElement('p');
      label.className = 'at-store-item__num';
      label.textContent = `ITEM ${String(item.id).padStart(2, '0')}`;

      const tagline = document.createElement('p');
      tagline.className = 'at-store-item__tagline';
      tagline.textContent = item.tagline;

      const price = document.createElement('p');
      price.className = 'at-store-item__price';
      price.textContent = '— ???';

      body.appendChild(label);
      body.appendChild(tagline);
      body.appendChild(price);

      const buyBtn = document.createElement('button');
      buyBtn.className = 'at-btn-sm at-store-item__buy';
      buyBtn.textContent = 'Purchase';
      buyBtn.disabled = true;

      card.appendChild(icon);
      card.appendChild(body);
      card.appendChild(buyBtn);
      grid.appendChild(card);
    }

    this.container.appendChild(grid);

    // Back button
    const back = document.createElement('button');
    back.textContent = '← Back';
    back.className = 'at-btn at-btn-stagger';
    back.style.animationDelay = '0.35s';
    back.style.marginTop = '20px';
    back.addEventListener('click', () => this.onBack());
    this.container.appendChild(back);
  }
}
