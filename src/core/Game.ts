import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';
import { bus } from './EventBus';
import { EVENTS } from '../types/events';
import { Renderer } from '../rendering/Renderer';
import { CameraController } from '../rendering/CameraController';
import { Grid } from '../world/Grid';
import { Character } from '../entities/Character';
import { InputManager } from '../input/InputManager';
import { MovementSystem } from '../systems/MovementSystem';
import { TurnManager } from './TurnManager';
import { TileState } from '../types/grid';
import type { GridCoord } from '../types/grid';
import { gameConfig, characters as characterConfigs } from '../config/gameConfig';

const MAX_DT = 0.1;

export class Game {
  private renderer: Renderer;
  private cameraController: CameraController;
  private scene: THREE.Scene;
  private grid: Grid;
  private characters: Map<number, Character> = new Map();
  private turnManager: TurnManager;
  private inputManager: InputManager;
  private movementSystem: MovementSystem;
  private lastTime: number | null = null;
  private composer: EffectComposer;

  private hoveredCoord: GridCoord | null = null;
  private selectedCoord: GridCoord | null = null;
  private reachableCoords = new Set<string>();

  private turnIndicator: HTMLDivElement;

  constructor() {
    this.renderer = new Renderer();
    this.cameraController = new CameraController();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(gameConfig.scene.background);
    this.scene.fog = new THREE.Fog(
      new THREE.Color(gameConfig.scene.fogColor),
      gameConfig.scene.fogNear,
      gameConfig.scene.fogFar
    );

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, gameConfig.scene.ambientIntensity);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, gameConfig.scene.dirLightIntensity);
    dirLight.position.set(-6, 12, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    // World
    this.grid = new Grid(this.scene);

    // Characters — built from config; adding a 3rd character only requires a config entry
    for (const cfg of characterConfigs) {
      const char = new Character(cfg);
      this.characters.set(cfg.playerIndex, char);
      this.scene.add(char.group);
      this.grid.getTile(cfg.startCoord)?.setState(TileState.Occupied);
      char.onMoveComplete = (coord) => bus.emit(EVENTS.CHARACTER_MOVE_END, { coord });
    }

    // Turn manager
    this.turnManager = new TurnManager(characterConfigs.map(c => c.playerIndex));

    // Systems
    this.inputManager = new InputManager(
      this.renderer.canvas,
      this.cameraController.camera,
      this.grid.tileMeshes
    );
    this.movementSystem = new MovementSystem(
      this.grid,
      this.getActiveCharacter,
      this.isOccupied
    );

    // Event subscriptions
    bus.on(EVENTS.TILE_HOVER_ENTER, ({ coord }) => {
      if (this.hoveredCoord) {
        const prev = this.grid.getTile(this.hoveredCoord);
        if (prev && prev.state === TileState.Hover) {
          const key = `${this.hoveredCoord.col},${this.hoveredCoord.row}`;
          prev.setState(this.reachableCoords.has(key) ? TileState.Reachable : TileState.Default);
        }
      }
      this.hoveredCoord = coord;
      const tile = this.grid.getTile(coord);
      if (tile && (tile.state === TileState.Default || tile.state === TileState.Reachable)) {
        tile.setState(TileState.Hover);
      }
    });

    bus.on(EVENTS.TILE_HOVER_EXIT, ({ coord }) => {
      const tile = this.grid.getTile(coord);
      if (tile && tile.state === TileState.Hover) {
        const key = `${coord.col},${coord.row}`;
        tile.setState(this.reachableCoords.has(key) ? TileState.Reachable : TileState.Default);
      }
      if (this.hoveredCoord?.col === coord.col && this.hoveredCoord?.row === coord.row) {
        this.hoveredCoord = null;
      }
    });

    bus.on(EVENTS.CHARACTER_MOVE_START, ({ from, to }) => {
      this.clearReachable();
      this.grid.getTile(from)?.setState(TileState.Default);
      if (this.selectedCoord) {
        const prev = this.grid.getTile(this.selectedCoord);
        if (prev && prev.state === TileState.Selected) prev.setState(TileState.Default);
      }
      this.selectedCoord = to;
      const tile = this.grid.getTile(to);
      if (tile) tile.setState(TileState.Selected);
    });

    bus.on(EVENTS.CHARACTER_MOVE_END, ({ coord }) => {
      const tile = this.grid.getTile(coord);
      if (tile) tile.setState(TileState.Occupied);
      this.turnManager.nextTurn();
    });

    bus.on(EVENTS.TURN_CHANGED, ({ player }) => {
      const char = this.characters.get(player);
      this.turnIndicator.textContent = char ? `${char.name}'s Turn` : `Player ${player}'s Turn`;
      this.showReachable(this.getActiveCharacter());
    });

    bus.on(EVENTS.RENDERER_RESIZED, ({ width, height }) => {
      this.composer.setSize(width, height);
    });

    // Post-processing
    this.composer = new EffectComposer(this.renderer.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.cameraController.camera));
    this.composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      gameConfig.vfx.bloomStrength,
      gameConfig.vfx.bloomRadius,
      gameConfig.vfx.bloomThreshold
    ));
    this.composer.addPass(new OutputPass());

    // Turn indicator DOM overlay
    const firstChar = this.characters.get(characterConfigs[0].playerIndex);
    this.turnIndicator = document.createElement('div');
    this.turnIndicator.id = 'turn-indicator';
    this.turnIndicator.textContent = firstChar ? `${firstChar.name}'s Turn` : "Player 1's Turn";
    Object.assign(this.turnIndicator.style, {
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      color: '#ffffff',
      background: 'rgba(0,0,0,0.55)',
      padding: '6px 18px',
      borderRadius: '6px',
      fontSize: '16px',
      fontFamily: 'sans-serif',
      pointerEvents: 'none',
      zIndex: '100',
    });
    document.body.appendChild(this.turnIndicator);

    // Show reachable tiles for the starting character
    this.showReachable(this.getActiveCharacter());
  }

  private getActiveCharacter = (): Character =>
    this.characters.get(this.turnManager.activePlayer)!;

  private isOccupied = (coord: GridCoord): boolean =>
    [...this.characters.values()].some(c => c.coord.col === coord.col && c.coord.row === coord.row);

  private showReachable(char: Character): void {
    this.clearReachable();
    for (const tile of this.grid.allTiles()) {
      const { col, row } = tile.coord;
      const dist = Math.abs(col - char.coord.col) + Math.abs(row - char.coord.row);
      if (dist > 0 && dist <= char.moveRange && tile.state !== TileState.Occupied) {
        tile.setState(TileState.Reachable);
        this.reachableCoords.add(`${col},${row}`);
      }
    }
  }

  private clearReachable(): void {
    for (const key of this.reachableCoords) {
      const [col, row] = key.split(',').map(Number);
      const tile = this.grid.getTile({ col, row });
      if (tile && tile.state === TileState.Reachable) tile.setState(TileState.Default);
    }
    this.reachableCoords.clear();
  }

  start(): void {
    requestAnimationFrame(this.loop);
  }

  dispose(): void {
    this.inputManager.dispose();
    this.movementSystem.dispose();
    this.turnIndicator.remove();
  }

  private loop = (timestamp: number): void => {
    requestAnimationFrame(this.loop);

    const dt = this.lastTime === null ? 0 : Math.min((timestamp - this.lastTime) / 1000, MAX_DT);
    this.lastTime = timestamp;

    for (const char of this.characters.values()) char.update(dt);

    this.composer.render();
  };
}
