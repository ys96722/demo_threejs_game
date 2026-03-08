import * as THREE from 'three';
import { bus } from './EventBus';
import { EVENTS } from '../types/events';
import { Renderer } from '../rendering/Renderer';
import { CameraController } from '../rendering/CameraController';
import { Grid } from '../world/Grid';
import { Character } from '../entities/Character';
import { InputManager } from '../input/InputManager';
import { MovementSystem } from '../systems/MovementSystem';
import { TileState } from '../types/grid';
import type { GridCoord } from '../types/grid';

const MAX_DT = 0.1;

export class Game {
  private renderer: Renderer;
  private cameraController: CameraController;
  private scene: THREE.Scene;
  private grid: Grid;
  private character: Character;
  private inputManager: InputManager;
  private movementSystem: MovementSystem;
  private lastTime: number | null = null;

  private hoveredCoord: GridCoord | null = null;
  private selectedCoord: GridCoord | null = null;

  constructor() {
    this.renderer = new Renderer();
    this.cameraController = new CameraController();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);

    // World
    this.grid = new Grid(this.scene);
    this.character = new Character({ col: 3, row: 3 });
    this.scene.add(this.character.group);

    // Systems
    this.inputManager = new InputManager(
      this.renderer.canvas,
      this.cameraController.camera,
      this.grid.tileMeshes
    );
    this.movementSystem = new MovementSystem(this.grid, this.character);

    // Event subscriptions
    bus.on(EVENTS.TILE_HOVER_ENTER, ({ coord }) => {
      if (this.hoveredCoord) {
        const prev = this.grid.getTile(this.hoveredCoord);
        if (prev && prev.state === TileState.Hover) prev.setState(TileState.Default);
      }
      this.hoveredCoord = coord;
      const tile = this.grid.getTile(coord);
      if (tile && tile.state === TileState.Default) tile.setState(TileState.Hover);
    });

    bus.on(EVENTS.TILE_HOVER_EXIT, ({ coord }) => {
      const tile = this.grid.getTile(coord);
      if (tile && tile.state === TileState.Hover) tile.setState(TileState.Default);
      if (this.hoveredCoord?.col === coord.col && this.hoveredCoord?.row === coord.row) {
        this.hoveredCoord = null;
      }
    });

    bus.on(EVENTS.CHARACTER_MOVE_START, ({ to }) => {
      // Clear previous selected tile
      if (this.selectedCoord) {
        const prev = this.grid.getTile(this.selectedCoord);
        if (prev) prev.setState(TileState.Default);
      }
      this.selectedCoord = to;
      const tile = this.grid.getTile(to);
      if (tile) tile.setState(TileState.Selected);
    });

    bus.on(EVENTS.CHARACTER_MOVE_END, ({ coord }) => {
      const tile = this.grid.getTile(coord);
      if (tile) tile.setState(TileState.Occupied);
    });

    this.character.onMoveComplete = (coord) => {
      bus.emit(EVENTS.CHARACTER_MOVE_END, { coord });
    };
  }

  start(): void {
    requestAnimationFrame(this.loop);
  }

  dispose(): void {
    this.inputManager.dispose();
    this.movementSystem.dispose();
  }

  private loop = (timestamp: number): void => {
    requestAnimationFrame(this.loop);

    const dt = this.lastTime === null ? 0 : Math.min((timestamp - this.lastTime) / 1000, MAX_DT);
    this.lastTime = timestamp;

    this.character.update(dt);
    this.renderer.render(this.scene, this.cameraController.camera);
  };
}
