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
import { computeDisplaceDir, computeAttackDamage } from '../logic/combat';
import { GameClient } from '../net/GameClient';
import type { GameMode } from './GameMode';

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
  private gameClient: GameClient | null = null;

  private hoveredCoord: GridCoord | null = null;
  private reachableCoords = new Set<string>();
  private attackRangeCoords = new Set<string>();

  private turnCounter: HTMLDivElement;
  private turnIndicator: HTMLDivElement;
  private chatInput: HTMLInputElement;

  // Tracks the currently active team — updated in solo mode by TurnManager and
  // in PvP mode by TURN_CHANGED events forwarded from the server via GameClient.
  private activeTeam: number;

  constructor(private mode: GameMode = { kind: 'solo' }) {
    // Inject chat float animation once
    const style = document.createElement('style');
    style.textContent = `
      @keyframes chat-float {
        0%   { opacity: 0;   transform: translateY(0); }
        15%  { opacity: 1;   transform: translateY(-30px); }
        75%  { opacity: 1;   transform: translateY(-150px); }
        100% { opacity: 0;   transform: translateY(-200px); }
      }
      .chat-message {
        position: fixed;
        left: 24px;
        bottom: 64px;
        color: #ffffff;
        font-family: sans-serif;
        font-size: 14px;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        pointer-events: none;
        z-index: 150;
        animation: chat-float 5s ease-in-out forwards;
      }
    `;
    document.head.appendChild(style);

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
    this.activeTeam = this.turnManager.activePlayer;

    // Show tokens only for the first active team's characters
    for (const c of this.characters.values()) {
      c.setTokensVisible(c.team === this.activeTeam);
    }

    // In PvP mode, attach the GameClient now that characters are ready
    if (mode.kind === 'pvp') {
      this.gameClient = new GameClient(mode.ws, this.characters);
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
        // In PvP mode the local player can only select their own team on their own turn.
        if (this.mode.kind === 'pvp' && this.mode.localTeam !== this.activeTeam) return undefined;
        const teamFilter = this.mode.kind === 'pvp' ? this.mode.localTeam : this.activeTeam;
        return [...this.characters.values()].find(
          c => c.team === teamFilter && c.coord.col === coord.col && c.coord.row === coord.row
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
          const { dc, dr } = computeDisplaceDir(caster, target);
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
          return { type: 'displace', ...computeDisplaceDir(caster, target) };
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
      if (this.mode.kind === 'solo') this.checkTurnEnd();
    });

    bus.on(EVENTS.ACTION_USED, () => {
      if (this.mode.kind === 'solo') this.checkTurnEnd();
    });

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
      if (this.mode.kind === 'pvp') {
        this.gameClient?.send({ type: 'SKILL', payload: { casterIndex, skillName, targetCoord } });
        return;
      }
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

      caster.actionTokens -= 1;
      caster.moveTokens = 0;
      caster.updateTokenDisplay();
      bus.emit(EVENTS.ACTION_USED, { playerIndex: casterIndex });
    });

    // Attack intent: emitted by SelectionSystem when player confirms an attack target.
    // Solo mode: apply damage here. PvP mode: forward to server; server sends STATE_UPDATE.
    bus.on(EVENTS.ATTACK_INTENT, ({ attackerIndex, targetCoord }) => {
      if (this.mode.kind === 'pvp') {
        this.gameClient?.send({ type: 'ATTACK', payload: { attackerIndex, targetCoord } });
        return;
      }
      const attacker = this.characters.get(attackerIndex);
      if (!attacker) return;
      const enemy = [...this.characters.values()].find(
        c => c.team !== attacker.team &&
             c.coord.col === targetCoord.col && c.coord.row === targetCoord.row
      );
      if (!enemy) return;
      const damage = computeAttackDamage(attacker, enemy);
      enemy.setHp(enemy.hp - damage);
      attacker.actionTokens -= 1;
      attacker.moveTokens = 0;
      attacker.updateTokenDisplay();
      bus.emit(EVENTS.ACTION_USED, { playerIndex: attackerIndex });
    });

    // Move intent: emitted by MovementSystem (no local mutation).
    // Solo mode: apply the move here. PvP mode: forward to server; server sends STATE_UPDATE.
    bus.on(EVENTS.MOVE_INTENT, ({ characterIndex, from, to }) => {
      if (this.mode.kind === 'pvp') {
        this.gameClient?.send({ type: 'MOVE', payload: { characterIndex, from, to } });
        bus.emit(EVENTS.CHARACTER_DESELECTED, { playerIndex: characterIndex });
        return;
      }
      const char = this.characters.get(characterIndex);
      if (!char) return;
      char.moveTokens -= 1;
      char.updateTokenDisplay();
      char.moveTo(to);
      bus.emit(EVENTS.CHARACTER_MOVE_START, { from, to });
    });

    // Spend action intent: emitted by SelectionSystem for Transcend/Hold.
    // Solo mode: apply token spend here. PvP mode: forward to server.
    bus.on(EVENTS.SPEND_ACTION_INTENT, ({ playerIndex }) => {
      if (this.mode.kind === 'pvp') {
        this.gameClient?.send({ type: 'SPEND_ACTION', payload: { playerIndex } });
        return;
      }
      const char = this.characters.get(playerIndex);
      if (!char) return;
      char.actionTokens -= 1;
      char.moveTokens = 0;
      char.updateTokenDisplay();
      bus.emit(EVENTS.ACTION_USED, { playerIndex });
    });

    bus.on(EVENTS.TARGET_PREVIEW_START, ({ targetPlayerIndex, preview }) => {
      this.characters.get(targetPlayerIndex)?.showEffectPreview(preview);
    });

    bus.on(EVENTS.TARGET_PREVIEW_END, ({ targetPlayerIndex }) => {
      this.characters.get(targetPlayerIndex)?.clearEffectPreview();
    });

    bus.on(EVENTS.TURN_CHANGED, ({ player, turnCount }) => {
      this.activeTeam = player;
      this.turnCounter.textContent = `Current Turn: ${turnCount ?? this.turnManager.turnCount}`;
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

    bus.on(EVENTS.GAME_OVER, ({ winnerTeam }) => {
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed', inset: '0', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)', zIndex: '200', color: '#fff', fontFamily: 'sans-serif',
      });
      const msg = document.createElement('h1');
      msg.textContent = `Team ${winnerTeam} wins!`;
      Object.assign(msg.style, { fontSize: '48px', margin: '0 0 24px' });
      overlay.appendChild(msg);
      document.body.appendChild(overlay);
    });

    bus.on(EVENTS.OPPONENT_DISCONNECTED, () => {
      const banner = document.createElement('div');
      banner.textContent = 'Opponent disconnected.';
      Object.assign(banner.style, {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '24px 40px',
        borderRadius: '10px', fontFamily: 'sans-serif', fontSize: '20px', zIndex: '200',
      });
      document.body.appendChild(banner);
    });

    bus.on(EVENTS.NETWORK_ACTION_REJECTED, ({ reason }) => {
      console.warn('[GameClient] Action rejected by server:', reason);
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
    this.turnIndicator.textContent = `Player ${this.activeTeam}'s Turn`;
    Object.assign(this.turnIndicator.style, { ...sharedStyle, top: '52px', fontSize: '16px' });
    document.body.appendChild(this.turnIndicator);

    // Chat input
    this.chatInput = document.createElement('input');
    Object.assign(this.chatInput.style, {
      position: 'fixed', left: '24px', bottom: '24px',
      width: '220px', padding: '6px 10px',
      background: 'rgba(0,0,0,0.55)', color: '#fff',
      border: '1px solid rgba(255,255,255,0.25)', borderRadius: '4px',
      fontFamily: 'sans-serif', fontSize: '13px',
      outline: 'none', zIndex: '150',
    });
    this.chatInput.placeholder = 'Press Enter to chat…';
    this.chatInput.addEventListener('keydown', this.handleChatKeyDown);
    document.body.appendChild(this.chatInput);

    bus.on(EVENTS.CHAT_RECEIVED, ({ team, text }) => {
      const el = document.createElement('div');
      el.className = 'chat-message';
      el.textContent = `Team ${team}: ${text}`;
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    });
  }

  private handleChatKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter') return;
    const text = this.chatInput.value.trim();
    if (!text) return;
    this.chatInput.value = '';
    if (this.mode.kind === 'pvp') {
      this.gameClient?.send({ type: 'CHAT', payload: { text } });
    } else {
      bus.emit(EVENTS.CHAT_RECEIVED, { team: 1, text });
    }
  };

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

  private applyDisplace(mover: Character, target: Character): void {
    const { dc, dr } = computeDisplaceDir(mover, target);
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
    this.gameClient?.close();
    this.turnCounter.remove();
    this.turnIndicator.remove();
    this.chatInput.remove();
  }

  private loop = (timestamp: number): void => {
    requestAnimationFrame(this.loop);

    const dt = this.lastTime === null ? 0 : Math.min((timestamp - this.lastTime) / 1000, MAX_DT);
    this.lastTime = timestamp;

    for (const char of this.characters.values()) char.update(dt);

    this.composer.render();
  };
}
