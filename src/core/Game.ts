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
import { SelectionSystem } from '../systems/SelectionSystem';
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
  private selectionSystem: SelectionSystem;
  private movementSystem: MovementSystem;
  private lastTime: number | null = null;
  private composer: EffectComposer;

  private hoveredCoord: GridCoord | null = null;
  private reachableCoords = new Set<string>();
  private attackRangeCoords = new Set<string>();

  private turnCounter: HTMLDivElement;
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

    // Turn manager cycles over unique teams, not individual character indices
    const teams = [...new Set(characterConfigs.map(c => c.team))];
    this.turnManager = new TurnManager(teams);

    // Show tokens only for the first active team's characters
    for (const c of this.characters.values()) {
      c.setTokensVisible(c.team === this.turnManager.activePlayer);
    }

    // Systems
    this.inputManager = new InputManager(
      this.renderer.canvas,
      this.cameraController.camera,
      this.grid.tileMeshes
    );
    this.selectionSystem = new SelectionSystem(
      (idx) => this.characters.get(idx),
      (coord) => this.reachableCoords.has(`${coord.col},${coord.row}`),
      (coord, attackerIdx) => {
        const attacker = this.characters.get(attackerIdx);
        if (!attacker) return undefined;
        return [...this.characters.values()].find(
          c => c.team !== attacker.team && c.coord.col === coord.col && c.coord.row === coord.row
        );
      },
      (coord) => {
        const activeTeam = this.turnManager.activePlayer;
        return [...this.characters.values()].find(
          c => c.team === activeTeam && c.coord.col === coord.col && c.coord.row === coord.row
        );
      },
      (casterIndex, skillName, targetCoord) => {
        if (skillName === 'Abrazo o Desprecio (Embrace or Exile)') {
          const caster = this.characters.get(casterIndex);
          if (!caster) return false;
          const target = [...this.characters.values()].find(
            c => c.playerIndex !== casterIndex &&
                 c.coord.col === targetCoord.col && c.coord.row === targetCoord.row
          );
          if (!target) return false;
          const { dc, dr } = this.computeDisplaceDir(caster, target);
          const dest = { col: target.coord.col + dc, row: target.coord.row + dr };
          return this.grid.isValid(dest) && !this.isOccupied(dest);
        }
        return true;
      },
      (casterIndex, skillName, targetCoord) => {
        if (skillName === 'Reveille of Black Cranes') {
          return { type: 'buff', stat: 'Defense', amount: 10 };
        }
        if (skillName === 'Abrazo o Desprecio (Embrace or Exile)') {
          const caster = this.characters.get(casterIndex);
          if (!caster) return null;
          const target = [...this.characters.values()].find(
            c => c.playerIndex !== casterIndex &&
                 c.coord.col === targetCoord.col && c.coord.row === targetCoord.row
          );
          if (!target) return null;
          return { type: 'displace', ...this.computeDisplaceDir(caster, target) };
        }
        return null;
      }
    );
    this.movementSystem = new MovementSystem(
      this.grid,
      () => this.selectionSystem.isTargeting ? null : this.selectionSystem.selectedCharacter,
      this.isOccupied
    );

    // Event subscriptions
    bus.on(EVENTS.TILE_HOVER_ENTER, ({ coord }) => {
      if (this.hoveredCoord) {
        const prev = this.grid.getTile(this.hoveredCoord);
        if (prev && prev.state === TileState.Hover) {
          prev.setState(this.restoreState(this.hoveredCoord));
        }
      }
      this.hoveredCoord = coord;
      const tile = this.grid.getTile(coord);
      if (tile && (tile.state === TileState.Default || tile.state === TileState.Reachable || tile.state === TileState.AttackRange || tile.state === TileState.ReachableAttack)) {
        tile.setState(TileState.Hover);
      }
    });

    bus.on(EVENTS.TILE_HOVER_EXIT, ({ coord }) => {
      const tile = this.grid.getTile(coord);
      if (tile && tile.state === TileState.Hover) {
        tile.setState(this.restoreState(coord));
      }
      if (this.hoveredCoord?.col === coord.col && this.hoveredCoord?.row === coord.row) {
        this.hoveredCoord = null;
      }
    });

    bus.on(EVENTS.CHARACTER_SELECTED, ({ playerIndex }) => {
      const char = this.characters.get(playerIndex);
      if (!char) return;
      char.setSelected(true);
      if (char.moveTokens > 0) this.showReachable(char);
    });

    bus.on(EVENTS.ATTACK_TARGETING_START, ({ playerIndex }) => {
      const char = this.characters.get(playerIndex);
      if (!char) return;
      this.clearReachable();
      this.showAttackRange(char);
    });

    bus.on(EVENTS.ATTACK_TARGETING_CANCELLED, ({ playerIndex }) => {
      this.clearAttackRange();
      const char = this.characters.get(playerIndex);
      if (char && char.moveTokens > 0) this.showReachable(char);
    });

    bus.on(EVENTS.CHARACTER_DESELECTED, ({ playerIndex }) => {
      this.characters.get(playerIndex)?.setSelected(false);
      this.clearReachable();
      this.clearAttackRange();
    });

    bus.on(EVENTS.CHARACTER_MOVE_START, ({ from, to }) => {
      this.clearReachable();
      this.clearAttackRange();
      this.grid.getTile(from)?.setState(TileState.Default);
      this.grid.getTile(to)?.setState(TileState.Selected);
    });

    bus.on(EVENTS.CHARACTER_MOVE_END, ({ coord }) => {
      this.grid.getTile(coord)?.setState(TileState.Occupied);
      this.checkTurnEnd();
    });

    bus.on(EVENTS.ACTION_USED, () => this.checkTurnEnd());

    bus.on(EVENTS.RANGE_PREVIEW_START, ({ playerIndex, range }) => {
      const char = this.characters.get(playerIndex);
      if (!char) return;
      this.showAttackRange(char, range);
    });

    bus.on(EVENTS.RANGE_PREVIEW_END, () => {
      this.clearAttackRange();
    });

    bus.on(EVENTS.SKILL_TARGETING_START, ({ playerIndex, range }) => {
      const char = this.characters.get(playerIndex);
      if (!char) return;
      this.clearReachable();
      this.showAttackRange(char, range);
    });

    bus.on(EVENTS.SKILL_TARGETING_CANCELLED, ({ playerIndex }) => {
      this.clearAttackRange();
      const char = this.characters.get(playerIndex);
      if (char && char.moveTokens > 0) this.showReachable(char);
    });

    bus.on(EVENTS.SKILL_HIT, ({ casterIndex, skillName, targetCoord }) => {
      const caster = this.characters.get(casterIndex);
      if (!caster) return;
      const target = [...this.characters.values()].find(
        c => c.playerIndex !== casterIndex &&
             c.coord.col === targetCoord.col && c.coord.row === targetCoord.row
      );
      if (!target) return;

      if (skillName === 'Reveille of Black Cranes') {
        target.defense += 10;
      } else if (skillName === 'Abrazo o Desprecio (Embrace or Exile)') {
        this.applyDisplace(caster, target);
      }
    });

    bus.on(EVENTS.TARGET_PREVIEW_START, ({ targetPlayerIndex, preview }) => {
      this.characters.get(targetPlayerIndex)?.showEffectPreview(preview);
    });

    bus.on(EVENTS.TARGET_PREVIEW_END, ({ targetPlayerIndex }) => {
      this.characters.get(targetPlayerIndex)?.clearEffectPreview();
    });

    bus.on(EVENTS.TURN_CHANGED, ({ player }) => {
      this.turnCounter.textContent = `Current Turn: ${this.turnManager.turnCount}`;
      this.turnIndicator.textContent = `Player ${player}'s Turn`;
      for (const c of this.characters.values()) {
        c.setSelected(false);
        c.setTokensVisible(c.team === player);
        if (c.team === player) c.resetTurn();
      }
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

    // Turn counter + indicator DOM overlays
    const sharedStyle = {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      color: '#ffffff',
      background: 'rgba(0,0,0,0.55)',
      padding: '6px 18px',
      borderRadius: '6px',
      fontFamily: 'sans-serif',
      pointerEvents: 'none',
      zIndex: '100',
    };

    this.turnCounter = document.createElement('div');
    this.turnCounter.id = 'turn-counter';
    this.turnCounter.textContent = `Current Turn: ${this.turnManager.turnCount}`;
    Object.assign(this.turnCounter.style, { ...sharedStyle, top: '16px', fontSize: '14px' });
    document.body.appendChild(this.turnCounter);

    this.turnIndicator = document.createElement('div');
    this.turnIndicator.id = 'turn-indicator';
    this.turnIndicator.textContent = `Player ${this.turnManager.activePlayer}'s Turn`;
    Object.assign(this.turnIndicator.style, { ...sharedStyle, top: '52px', fontSize: '16px' });
    document.body.appendChild(this.turnIndicator);
  }

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
      if (!tile) continue;
      if (tile.state === TileState.Reachable) tile.setState(TileState.Default);
      // Tile was in both ranges — degrade to AttackRange only
      else if (tile.state === TileState.ReachableAttack) tile.setState(TileState.AttackRange);
    }
    this.reachableCoords.clear();
  }

  private showAttackRange(char: Character, range?: number): void {
    this.clearAttackRange();
    const r = range ?? char.attackRange;
    for (const tile of this.grid.allTiles()) {
      const { col, row } = tile.coord;
      const dist = Math.abs(col - char.coord.col) + Math.abs(row - char.coord.row);
      if (dist < 1 || dist > r) continue;
      this.attackRangeCoords.add(`${col},${row}`);
      // Upgrade Reachable → ReachableAttack so both ranges are visible
      if (tile.state === TileState.Reachable) tile.setState(TileState.ReachableAttack);
      else if (tile.state !== TileState.Occupied) tile.setState(TileState.AttackRange);
    }
  }

  private clearAttackRange(): void {
    for (const key of this.attackRangeCoords) {
      const [col, row] = key.split(',').map(Number);
      const tile = this.grid.getTile({ col, row });
      if (!tile) continue;
      if (tile.state === TileState.AttackRange) tile.setState(TileState.Default);
      // Tile was in both ranges — degrade to Reachable only
      else if (tile.state === TileState.ReachableAttack) tile.setState(TileState.Reachable);
    }
    this.attackRangeCoords.clear();
  }

  private restoreState(coord: GridCoord): TileState {
    const key = `${coord.col},${coord.row}`;
    const inMove = this.reachableCoords.has(key);
    const inAttack = this.attackRangeCoords.has(key);
    if (inMove && inAttack) return TileState.ReachableAttack;
    if (inMove) return TileState.Reachable;
    if (inAttack) return TileState.AttackRange;
    return TileState.Default;
  }

  private computeDisplaceDir(mover: Character, target: Character): { dc: number; dr: number } {
    const isEnemy = target.team !== mover.team;
    return {
      dc: isEnemy ? Math.sign(target.coord.col - mover.coord.col) : Math.sign(mover.coord.col - target.coord.col),
      dr: isEnemy ? Math.sign(target.coord.row - mover.coord.row) : Math.sign(mover.coord.row - target.coord.row),
    };
  }

  private applyDisplace(mover: Character, target: Character): void {
    const { dc, dr } = this.computeDisplaceDir(mover, target);
    const dest = { col: target.coord.col + dc, row: target.coord.row + dr };
    if (!this.grid.isValid(dest) || this.isOccupied(dest)) return;
    const from = target.coord;
    target.moveTo(dest);
    bus.emit(EVENTS.CHARACTER_MOVE_START, { from, to: dest });
  }

  private checkTurnEnd(): void {
    const active = this.turnManager.activePlayer;
    const allSpent = [...this.characters.values()]
      .filter(c => c.team === active)
      .every(c => c.actionTokens === 0);
    if (allSpent) this.turnManager.nextTurn();
  }

  start(): void {
    requestAnimationFrame(this.loop);
  }

  dispose(): void {
    this.inputManager.dispose();
    this.selectionSystem.dispose();
    this.movementSystem.dispose();
    this.turnCounter.remove();
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
