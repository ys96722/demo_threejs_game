import * as THREE from 'three';
import { Tile } from '../world/Tile';
import { CharacterAnimator } from './CharacterAnimator';
import type { GridCoord } from '../types/grid';
import type { CharacterConfig, EffectPreview, SkillDef } from '../types/characters';
import { gameConfig } from '../config/gameConfig';

const loader = new THREE.TextureLoader();

// Loads a sprite PNG and makes the white background transparent.
//
// Sprite art tools (e.g. Aseprite) export with a solid white background by
// default. Three.js SpriteMaterial can't remove a background color on its own,
// so we do it manually via a hidden <canvas> element before handing the texture
// to Three.js.
//
// The removal uses HSB (hue-saturation-brightness) logic instead of a simple
// "is this pixel #ffffff?" check so that anti-aliased edge pixels — which blend
// the character color with white and end up as light grey — are also removed,
// preventing a visible "halo" around the sprite.
//
// How each pixel is evaluated:
//   maxC  — the brightest of the R, G, B channels (0–255). This equals the
//            "value/brightness" component in HSV color space.
//   minC  — the darkest channel. The gap between max and min captures how
//            colorful (saturated) the pixel is.
//   saturation = (maxC - minC) / maxC
//            0 = perfectly grey/white/black; 1 = fully saturated color.
//            We divide by maxC (not 255) so a dark red still reads as high
//            saturation — only truly grey pixels score near 0.
//   brightness = maxC / 255
//            0 = black; 1 = white.
//
// A pixel is erased (alpha set to 0) when BOTH are true:
//   brightness > 0.75  — the pixel is light (not part of a dark shadow or outline)
//   saturation < 0.15  — the pixel is nearly grey (not a colored part of the art)
//
// Colored clothing, skin tones, and shaded areas fail at least one condition
// and are kept fully opaque.
function loadTransparentTexture(url: string): THREE.Texture {
  return loader.load(url, (texture) => {
    const image = texture.image as HTMLImageElement;

    // Draw the loaded image onto an off-screen canvas so we can read and
    // modify individual pixels via getImageData / putImageData.
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);

    // imageData.data is a flat Uint8ClampedArray laid out as:
    //   [R, G, B, A,  R, G, B, A,  ...]
    // so every pixel occupies 4 consecutive indices; we step by 4.
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];

      // Brightness: how light is this pixel? (0 = black, 1 = white)
      const maxC = Math.max(r, g, b);
      const brightness = maxC / 255;

      // Saturation: how colorful is this pixel? (0 = grey, 1 = vivid color)
      // Guard against dividing by zero when the pixel is pure black (maxC = 0).
      const minC = Math.min(r, g, b);
      const saturation = maxC > 0 ? (maxC - minC) / maxC : 0;

      // Erase pixels that are both light AND unsaturated — i.e. the white/grey
      // background. Colored or dark pixels are left untouched.
      if (brightness > 0.75 && saturation < 0.15) {
        data[i + 3] = 0; // set alpha to fully transparent
      }
    }

    // Write the modified pixel data back to the canvas, then point the
    // Three.js texture at the canvas instead of the original <img> element.
    ctx.putImageData(imageData, 0, 0);
    texture.image = canvas;
    texture.needsUpdate = true; // tells Three.js to re-upload to the GPU
  });
}

export class Character {
  readonly playerIndex: number;
  readonly team: number;
  readonly name: string;
  readonly moveRange: number;
  readonly group: THREE.Group; // root transform; moved by the animator and idle bob
  private animator: CharacterAnimator;
  coord: GridCoord; // current grid position (updated immediately when a move starts)
  onMoveComplete: ((coord: GridCoord) => void) | null = null;
  moveTokens: number = 1;
  actionTokens: number = 1;

  // Stats
  hp: number;
  readonly maxHp: number;
  readonly strength: number;
  readonly intellect: number;
  defense: number;
  readonly resistance: number;
  readonly attackRange: number;
  readonly skills: SkillDef[];

  // Selection glow sprite
  private selectionGlow: THREE.Sprite;

  // Token indicator sprite (stored for visibility toggling)
  private tokenSprite: THREE.Sprite;

  // Health bar
  private healthBarCanvas: HTMLCanvasElement;
  private healthBarTexture: THREE.CanvasTexture;

  // Token indicator
  private tokenCanvas: HTMLCanvasElement;
  private tokenTexture: THREE.CanvasTexture;

  // Effect preview overlay (damage number, buff label, displacement arrow)
  private previewCanvas: HTMLCanvasElement;
  private previewTexture: THREE.CanvasTexture;
  private previewSprite: THREE.Sprite;

  // Accumulates elapsed time while the character is idle so the bob animation
  // progresses continuously between moves.
  private idleTime = 0;

  constructor(config: CharacterConfig) {
    this.playerIndex = config.playerIndex;
    this.team = config.team;
    this.name = config.name;
    this.moveRange = config.moveRange;
    this.coord = config.startCoord;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.strength = config.strength;
    this.intellect = config.intellect;
    this.defense = config.defense;
    this.resistance = config.resistance;
    this.attackRange = config.attackRange;
    this.skills = config.skills;
    this.group = new THREE.Group();
    this.animator = new CharacterAnimator();

    const texture = loadTransparentTexture(config.spritePath);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);

    // By default Three.js anchors a Sprite at its center. Setting center to
    // (0.5, 0) moves the anchor to the bottom-center so that sprite.position.y
    // represents the base of the sprite, not its middle.
    sprite.center.set(0.5, 0);

    // Lift the sprite so its base clears the top surface of the tile mesh.
    // tileHeight / 2 is the world-space y of the tile's top face.
    sprite.position.y = gameConfig.grid.tileHeight;

    const s = gameConfig.character.spriteScale;

    // Selection glow — same texture, slightly larger, additive blending with HDR warm color.
    // Rendered before the main sprite (renderOrder 0) so the main sprite draws cleanly on top.
    // HDR color values (> 1) exceed the bloom threshold and trigger UnrealBloomPass.
    const glowMat = new THREE.SpriteMaterial({
      map: texture,
      color: new THREE.Color(1.8, 1.4, 0.6),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.selectionGlow = new THREE.Sprite(glowMat);
    this.selectionGlow.center.set(0.5, 0);
    this.selectionGlow.position.y = gameConfig.grid.tileHeight;
    this.selectionGlow.scale.set(s * 1.25, s * 1.25, 1);
    this.selectionGlow.visible = false;
    this.group.add(this.selectionGlow);

    sprite.scale.set(s, s, 1);
    sprite.renderOrder = 1; // draw on top of glow
    this.group.add(sprite);

    // Health bar — canvas texture on a billboard sprite, positioned above the character sprite.
    // The character sprite is bottom-anchored at tileHeight and scaled to s world units tall,
    // so its top sits at roughly tileHeight + s in local y. Add a small gap above that.
    this.healthBarCanvas = document.createElement('canvas');
    this.healthBarCanvas.width = 128;
    this.healthBarCanvas.height = 16;
    this.healthBarTexture = new THREE.CanvasTexture(this.healthBarCanvas);
    const hbMat = new THREE.SpriteMaterial({ map: this.healthBarTexture, depthTest: false });
    const hbSprite = new THREE.Sprite(hbMat);
    hbSprite.renderOrder = 1;
    // Width = 1.2 world units, height = 0.15 world units (matches 128:16 canvas ratio ≈ 8:1)
    hbSprite.scale.set(1.2, 0.15, 1);
    hbSprite.position.y = gameConfig.grid.tileHeight + s + 0.2;
    this.group.add(hbSprite);
    this.drawHealthBar();

    // Token indicator — two dots above the health bar, guaranteed on top via renderOrder.
    this.tokenCanvas = document.createElement('canvas');
    this.tokenCanvas.width = 48;
    this.tokenCanvas.height = 20;
    this.tokenTexture = new THREE.CanvasTexture(this.tokenCanvas);
    const tokenMat = new THREE.SpriteMaterial({ map: this.tokenTexture, depthTest: false });
    this.tokenSprite = new THREE.Sprite(tokenMat);
    this.tokenSprite.renderOrder = 2;
    this.tokenSprite.scale.set(0.6, 0.24, 1);
    this.tokenSprite.position.y = gameConfig.grid.tileHeight + s + 0.42;
    this.tokenSprite.visible = false; // hidden until this player's turn
    this.group.add(this.tokenSprite);
    this.updateTokenDisplay();

    // Effect preview — canvas sprite above the token indicator.
    // Shows damage numbers, buff labels, or displacement arrows during targeting hover.
    this.previewCanvas = document.createElement('canvas');
    this.previewCanvas.width = 128;
    this.previewCanvas.height = 28;
    this.previewTexture = new THREE.CanvasTexture(this.previewCanvas);
    const previewMat = new THREE.SpriteMaterial({ map: this.previewTexture, depthTest: false });
    this.previewSprite = new THREE.Sprite(previewMat);
    this.previewSprite.renderOrder = 3;
    this.previewSprite.scale.set(1.2, 0.26, 1);
    this.previewSprite.position.y = gameConfig.grid.tileHeight + s + 0.74;
    this.previewSprite.visible = false;
    this.group.add(this.previewSprite);

    const worldPos = Tile.gridToWorld(config.startCoord);
    this.group.position.set(worldPos.x, 0, worldPos.z);

    this.animator.onComplete = () => {
      this.onMoveComplete?.(this.coord);
    };
  }

  // When previewHp and previewColor are provided the bar shows the preview state
  // (orange for damage, dark-green for healing) without touching this.hp.
  private drawHealthBar(previewHp?: number, previewColor?: string): void {
    const ctx = this.healthBarCanvas.getContext('2d')!;
    const { width, height } = this.healthBarCanvas;
    const hp = previewHp ?? this.hp;
    const fraction = Math.max(0, hp / this.maxHp);

    ctx.fillStyle = '#1a0000';
    ctx.fillRect(0, 0, width, height);

    if (Math.floor(width * fraction) > 0) {
      ctx.fillStyle = previewColor ?? (fraction > 0.5 ? '#22c55e' : fraction > 0.25 ? '#eab308' : '#ef4444');
      ctx.fillRect(0, 0, Math.floor(width * fraction), height);
    }

    this.healthBarTexture.needsUpdate = true;
  }

  setHp(value: number): void {
    this.hp = Math.max(0, Math.min(this.maxHp, value));
    this.drawHealthBar();
  }

  showEffectPreview(preview: EffectPreview): void {
    const ctx = this.previewCanvas.getContext('2d')!;
    const { width, height } = this.previewCanvas;
    ctx.clearRect(0, 0, width, height);

    const drawText = (text: string, color: string, fontSize: number): void => {
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Outline for legibility over any background
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(text, width / 2, height / 2);
      ctx.fillStyle = color;
      ctx.fillText(text, width / 2, height / 2);
    };

    if (preview.type === 'damage') {
      this.drawHealthBar(Math.max(0, this.hp - preview.amount), '#f97316');
      drawText(`-${preview.amount}`, '#f97316', 16);
    } else if (preview.type === 'heal') {
      this.drawHealthBar(Math.min(this.maxHp, this.hp + preview.amount), '#166534');
      drawText(`+${preview.amount}`, '#4ade80', 16);
    } else if (preview.type === 'buff') {
      drawText(`+${preview.amount} ${preview.stat}`, '#60a5fa', 13);
    } else if (preview.type === 'displace') {
      const arrows: Record<string, string> = {
        '1,0': '→', '-1,0': '←',
        '0,-1': '↑', '0,1': '↓',
        '1,-1': '↗', '-1,-1': '↖',
        '1,1': '↘', '-1,1': '↙',
      };
      drawText(arrows[`${preview.dc},${preview.dr}`] ?? '?', '#ffffff', 20);
    }

    this.previewTexture.needsUpdate = true;
    this.previewSprite.visible = true;
  }

  clearEffectPreview(): void {
    this.drawHealthBar(); // restore actual HP bar with normal colors
    this.previewSprite.visible = false;
  }

  setSelected(selected: boolean): void {
    this.selectionGlow.visible = selected;
  }

  setTokensVisible(visible: boolean): void {
    this.tokenSprite.visible = visible;
  }

  updateTokenDisplay(): void {
    const ctx = this.tokenCanvas.getContext('2d')!;
    const { width, height } = this.tokenCanvas;
    ctx.clearRect(0, 0, width, height);

    // Left dot = move token (blue), right dot = action token (yellow)
    const dots = [
      { x: 12, color: '#60a5fa', spent: this.moveTokens === 0 },
      { x: 36, color: '#fbbf24', spent: this.actionTokens === 0 },
    ];

    for (const { x, color, spent } of dots) {
      const r = 8;
      ctx.beginPath();
      ctx.arc(x, height / 2, r, 0, Math.PI * 2);
      if (spent) {
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    this.tokenTexture.needsUpdate = true;
  }

  resetTurn(): void {
    this.moveTokens = 1;
    this.actionTokens = 1;
    this.updateTokenDisplay();
  }

  moveTo(coord: GridCoord): void {
    if (this.animator.isPlaying) return;
    const target = Tile.gridToWorld(coord);
    const from = this.group.position.clone();
    from.y = 0; // reset any idle bob offset so the arc starts at ground level
    this.coord = coord;
    this.animator.start(from, target);
  }

  update(dt: number): void {
    if (this.animator.isPlaying) {
      // Delegate position updates entirely to the animator while a move is active.
      this.animator.update(this.group.position, dt);
    } else {
      // Idle bob: smoothly lifts the character up and down while standing still.
      //
      // Math.sin oscillates between -1 and +1. Adding 1 shifts it to 0..2,
      // then dividing by 2 normalises it to 0..1, so the group only ever
      // moves upward from its resting position (group.y = 0). This prevents
      // the sprite from dipping below the tile surface at the bottom of each cycle.
      this.idleTime += dt;
      this.group.position.y =
        ((Math.sin(this.idleTime * gameConfig.vfx.idleBobSpeed) + 1) / 2) * gameConfig.vfx.idleBobAmplitude;
    }
  }
}
