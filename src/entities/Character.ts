import * as THREE from 'three';
import { Tile } from '../world/Tile';
import { CharacterAnimator } from './CharacterAnimator';
import type { GridCoord } from '../types/grid';
import type { CharacterConfig } from '../types/characters';
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
  readonly name: string;
  readonly moveRange: number;
  readonly group: THREE.Group; // root transform; moved by the animator and idle bob
  private animator: CharacterAnimator;
  coord: GridCoord; // current grid position (updated immediately when a move starts)
  onMoveComplete: ((coord: GridCoord) => void) | null = null;

  // Accumulates elapsed time while the character is idle so the bob animation
  // progresses continuously between moves.
  private idleTime = 0;

  constructor(config: CharacterConfig) {
    this.playerIndex = config.playerIndex;
    this.name = config.name;
    this.moveRange = config.moveRange;
    this.coord = config.startCoord;
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
    sprite.scale.set(s, s, 1);
    this.group.add(sprite);

    const worldPos = Tile.gridToWorld(config.startCoord);
    this.group.position.set(worldPos.x, 0, worldPos.z);

    this.animator.onComplete = () => {
      this.onMoveComplete?.(this.coord);
    };
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
