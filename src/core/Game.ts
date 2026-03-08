import * as THREE from 'three';
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

const MAX_DT = 0.1;

export class Game {
  private renderer: Renderer;
  private cameraController: CameraController;
  private scene: THREE.Scene;
  private grid: Grid;
  private char1: Character;
  private char2: Character;
  private turnManager: TurnManager;
  private inputManager: InputManager;
  private movementSystem: MovementSystem;
  private lastTime: number | null = null;

  private hoveredCoord: GridCoord | null = null;
  private selectedCoord: GridCoord | null = null;

  private turnIndicator: HTMLDivElement;

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

    // Characters
    this.char1 = new Character(1, { col: 1, row: 1 });
    this.char2 = new Character(2, { col: 6, row: 6 });
    this.scene.add(this.char1.group);
    this.scene.add(this.char2.group);

    // Mark starting tiles as Occupied
    this.grid.getTile({ col: 1, row: 1 })?.setState(TileState.Occupied);
    this.grid.getTile({ col: 6, row: 6 })?.setState(TileState.Occupied);

    // Turn manager
    this.turnManager = new TurnManager();

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

    bus.on(EVENTS.CHARACTER_MOVE_START, ({ from, to }) => {
      // Clear source tile
      this.grid.getTile(from)?.setState(TileState.Default);
      // Clear previous selected tile
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
      this.turnIndicator.textContent = `Player ${player}'s Turn`;
    });

    this.char1.onMoveComplete = (coord) => {
      bus.emit(EVENTS.CHARACTER_MOVE_END, { coord });
    };
    this.char2.onMoveComplete = (coord) => {
      bus.emit(EVENTS.CHARACTER_MOVE_END, { coord });
    };

    // Turn indicator DOM overlay
    this.turnIndicator = document.createElement('div');
    this.turnIndicator.id = 'turn-indicator';
    this.turnIndicator.textContent = "Player 1's Turn";
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
  }

  private getActiveCharacter = (): Character =>
    this.turnManager.activePlayer === 1 ? this.char1 : this.char2;

  private isOccupied = (coord: GridCoord): boolean =>
    (coord.col === this.char1.coord.col && coord.row === this.char1.coord.row) ||
    (coord.col === this.char2.coord.col && coord.row === this.char2.coord.row);

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

    this.char1.update(dt);
    this.char2.update(dt);
    this.renderer.render(this.scene, this.cameraController.camera);
  };
}
