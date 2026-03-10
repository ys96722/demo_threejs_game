import { bus } from '../core/EventBus';
import { EVENTS } from '../types/events';
import type { Character } from '../entities/Character';
import type { EffectPreview, SkillDef } from '../types/characters';
import type { GridCoord } from '../types/grid';
import { computeAttackDamage } from '../logic/combat';

export class SelectionSystem {
  private selectedPlayerIndex: number | null = null;
  private isTargetingAttack: boolean = false;
  private isTargetingSkill: boolean = false;
  private activeSkill: SkillDef | null = null;
  private audioCtx: AudioContext | null = null;
  private actionPanel: HTMLDivElement;
  private previewTargetIndex: number | null = null;

  constructor(
    private getCharacter: (idx: number) => Character | undefined,
    private isReachable: (coord: GridCoord) => boolean,
    private getEnemyAtCoord: (coord: GridCoord, attackerPlayerIndex: number) => Character | undefined,
    private getOwnCharacterAtCoord: (coord: GridCoord) => Character | undefined,
    private canTargetWithSkill?: (casterIndex: number, skillName: string, targetCoord: GridCoord) => boolean,
    private getSkillPreview?: (casterIndex: number, skillName: string, targetCoord: GridCoord) => EffectPreview | null,
  ) {
    bus.on(EVENTS.TILE_CLICKED, this.handleTileClicked);
    bus.on(EVENTS.TILE_HOVER_ENTER, this.handleTileHoverEnter);
    bus.on(EVENTS.TILE_HOVER_EXIT, this.handleTileHoverExit);
    bus.on(EVENTS.CHARACTER_SELECTED, this.handleCharacterSelected);
    bus.on(EVENTS.CHARACTER_DESELECTED, this.handleCharacterDeselected);
    bus.on(EVENTS.TURN_CHANGED, this.handleTurnChanged);
    bus.on(EVENTS.CANVAS_CLICKED_EMPTY, this.handleCanvasClickedEmpty);
    window.addEventListener('keydown', this.handleKeyDown);

    this.actionPanel = this.createPanel();
    document.body.appendChild(this.actionPanel);
  }

  get selectedCharacter(): Character | null {
    if (this.selectedPlayerIndex === null) return null;
    return this.getCharacter(this.selectedPlayerIndex) ?? null;
  }

  get isTargeting(): boolean {
    return this.isTargetingAttack || this.isTargetingSkill;
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, {
      padding: '8px 12px',
      borderRadius: '4px',
      border: 'none',
      background: 'rgba(255,255,255,0.15)',
      color: '#ffffff',
      fontSize: '13px',
      cursor: 'pointer',
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.id = 'action-panel';
    Object.assign(panel.style, {
      position: 'fixed',
      right: '24px',
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'none',
      flexDirection: 'column',
      gap: '8px',
      background: 'rgba(0,0,0,0.7)',
      padding: '16px',
      borderRadius: '8px',
      fontFamily: 'sans-serif',
      zIndex: '100',
      minWidth: '140px',
    });

    const title = document.createElement('p');
    title.id = 'action-panel-title';
    Object.assign(title.style, {
      color: '#ffffff',
      margin: '0 0 8px 0',
      fontWeight: 'bold',
      fontSize: '14px',
      textAlign: 'center',
    });
    panel.appendChild(title);

    // Basic Attack — static button with range preview on hover
    const attackBtn = this.makeButton('Basic Attack', () => this.handleBasicAttackClick());
    attackBtn.id = 'action-btn-attack';
    attackBtn.addEventListener('mouseenter', () => {
      if (this.selectedPlayerIndex === null) return;
      const char = this.getCharacter(this.selectedPlayerIndex);
      if (!char) return;
      bus.emit(EVENTS.RANGE_PREVIEW_START, { playerIndex: this.selectedPlayerIndex, range: char.attackRange });
    });
    attackBtn.addEventListener('mouseleave', () => {
      if (this.isTargetingAttack || this.isTargetingSkill) return;
      bus.emit(EVENTS.RANGE_PREVIEW_END, {});
    });
    panel.appendChild(attackBtn);

    // Skill buttons slot — populated dynamically in showPanel
    const skillsSlot = document.createElement('div');
    skillsSlot.id = 'action-panel-skills';
    Object.assign(skillsSlot.style, { display: 'contents' });
    panel.appendChild(skillsSlot);

    panel.appendChild(this.makeButton('Transcend', () => this.handleActionClick()));
    panel.appendChild(this.makeButton('Hold', () => this.handleActionClick()));

    return panel;
  }

  // Basic Attack enters targeting mode — does NOT consume the token yet.
  private handleBasicAttackClick(): void {
    if (this.selectedPlayerIndex === null) return;
    const char = this.getCharacter(this.selectedPlayerIndex);
    if (!char || char.actionTokens === 0) return;
    this.isTargetingAttack = true;
    this.hidePanel();
    bus.emit(EVENTS.ATTACK_TARGETING_START, { playerIndex: this.selectedPlayerIndex });
  }

  // Use Skill — enters skill targeting mode for the given skill.
  private handleUseSkillClick(skill: SkillDef): void {
    if (this.selectedPlayerIndex === null) return;
    const char = this.getCharacter(this.selectedPlayerIndex);
    if (!char || char.actionTokens === 0) return;
    this.activeSkill = skill;
    this.isTargetingSkill = true;
    this.hidePanel();
    bus.emit(EVENTS.SKILL_TARGETING_START, { playerIndex: this.selectedPlayerIndex, range: skill.range });
  }

  // Other actions consume the token immediately and deselect.
  private handleActionClick(): void {
    if (this.selectedPlayerIndex === null) return;
    const char = this.getCharacter(this.selectedPlayerIndex);
    if (!char || char.actionTokens === 0) return;
    char.actionTokens -= 1;
    char.moveTokens = 0;
    char.updateTokenDisplay();
    const playerIndex = this.selectedPlayerIndex;
    this.selectedPlayerIndex = null;
    bus.emit(EVENTS.ACTION_USED, { playerIndex });
    bus.emit(EVENTS.CHARACTER_DESELECTED, { playerIndex });
  }

  private handleTileClicked = ({ coord }: { coord: GridCoord }): void => {
    if (this.isTargetingAttack) {
      this.handleAttackTargetClick(coord);
      return;
    }

    if (this.isTargetingSkill) {
      this.handleSkillTargetClick(coord);
      return;
    }

    const ownChar = this.getOwnCharacterAtCoord(coord);
    if (ownChar !== undefined) {
      if (this.selectedPlayerIndex === ownChar.playerIndex) {
        // Clicking the already-selected character → deselect
        bus.emit(EVENTS.CHARACTER_DESELECTED, { playerIndex: this.selectedPlayerIndex });
        this.selectedPlayerIndex = null;
      } else {
        // Clicking a different own character → switch selection
        if (this.selectedPlayerIndex !== null) {
          bus.emit(EVENTS.CHARACTER_DESELECTED, { playerIndex: this.selectedPlayerIndex });
        }
        this.selectedPlayerIndex = ownChar.playerIndex;
        bus.emit(EVENTS.CHARACTER_SELECTED, { playerIndex: ownChar.playerIndex, coord });
      }
      return;
    }

    // Clicking a non-reachable tile while movement is available → play deny sound, stay selected
    if (this.selectedPlayerIndex !== null && !this.isReachable(coord)) {
      const char = this.getCharacter(this.selectedPlayerIndex);
      if (char && char.moveTokens > 0) this.playInvalidSound();
    }
  };

  private handleTileHoverEnter = ({ coord }: { coord: GridCoord }): void => {
    // Always clear any existing preview before computing a new one
    this.clearPreview();

    if (!this.isTargetingAttack && !this.isTargetingSkill) return;
    if (this.selectedPlayerIndex === null) return;
    const caster = this.getCharacter(this.selectedPlayerIndex);
    if (!caster) return;

    // Caster's own tile has no preview
    if (coord.col === caster.coord.col && coord.row === caster.coord.row) return;

    const dist = Math.abs(coord.col - caster.coord.col) + Math.abs(coord.row - caster.coord.row);

    if (this.isTargetingAttack) {
      const enemy = this.getEnemyAtCoord(coord, caster.playerIndex);
      if (!enemy || dist > caster.attackRange) return;
      const damage = computeAttackDamage(caster, enemy);
      this.previewTargetIndex = enemy.playerIndex;
      bus.emit(EVENTS.TARGET_PREVIEW_START, { targetPlayerIndex: enemy.playerIndex, preview: { type: 'damage', amount: damage } });
      return;
    }

    if (this.isTargetingSkill && this.activeSkill) {
      const skill = this.activeSkill;
      let target: Character | undefined;
      if (skill.targetType === 'enemy') {
        target = this.getEnemyAtCoord(coord, caster.playerIndex);
      } else if (skill.targetType === 'ally') {
        target = this.getOwnCharacterAtCoord(coord);
      } else {
        target = this.getEnemyAtCoord(coord, caster.playerIndex) ?? this.getOwnCharacterAtCoord(coord);
      }
      if (!target || dist > skill.range) return;
      const extraValid = !this.canTargetWithSkill || this.canTargetWithSkill(this.selectedPlayerIndex, skill.name, coord);
      if (!extraValid) return;
      const preview = this.getSkillPreview?.(this.selectedPlayerIndex, skill.name, coord);
      if (!preview) return;
      this.previewTargetIndex = target.playerIndex;
      bus.emit(EVENTS.TARGET_PREVIEW_START, { targetPlayerIndex: target.playerIndex, preview });
    }
  };

  private handleTileHoverExit = (_: { coord: GridCoord }): void => {
    this.clearPreview();
  };

  private clearPreview(): void {
    if (this.previewTargetIndex !== null) {
      bus.emit(EVENTS.TARGET_PREVIEW_END, { targetPlayerIndex: this.previewTargetIndex });
      this.previewTargetIndex = null;
    }
  }

  private handleCanvasClickedEmpty = (): void => {
    if (this.selectedPlayerIndex === null) return;
    if (this.isTargetingAttack) {
      this.isTargetingAttack = false;
      bus.emit(EVENTS.ATTACK_TARGETING_CANCELLED, { playerIndex: this.selectedPlayerIndex });
    }
    if (this.isTargetingSkill) {
      this.isTargetingSkill = false;
      this.activeSkill = null;
      bus.emit(EVENTS.SKILL_TARGETING_CANCELLED, { playerIndex: this.selectedPlayerIndex });
    }
    bus.emit(EVENTS.CHARACTER_DESELECTED, { playerIndex: this.selectedPlayerIndex });
    this.selectedPlayerIndex = null;
  };

  private playSelectSound(): void {
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    const ctx = this.audioCtx;
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    playTone(523, ctx.currentTime, 0.14);        // C5
    playTone(659, ctx.currentTime + 0.09, 0.18); // E5
  }

  private playInvalidSound(): void {
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  }

  private handleAttackTargetClick(coord: GridCoord): void {
    if (this.selectedPlayerIndex === null) return;
    const attacker = this.getCharacter(this.selectedPlayerIndex);
    if (!attacker) return;

    // Clicking the attacker's own tile cancels targeting (like ESC)
    if (coord.col === attacker.coord.col && coord.row === attacker.coord.row) {
      this.isTargetingAttack = false;
      bus.emit(EVENTS.ATTACK_TARGETING_CANCELLED, { playerIndex: this.selectedPlayerIndex });
      this.showPanel(this.selectedPlayerIndex);
      return;
    }

    const dist = Math.abs(coord.col - attacker.coord.col) + Math.abs(coord.row - attacker.coord.row);
    const enemy = this.getEnemyAtCoord(coord, attacker.playerIndex);

    if (enemy && dist <= attacker.attackRange) {
      const damage = computeAttackDamage(attacker, enemy);
      enemy.setHp(enemy.hp - damage);
      attacker.actionTokens -= 1;
      attacker.moveTokens = 0;
      attacker.updateTokenDisplay();
      const playerIndex = this.selectedPlayerIndex;
      this.isTargetingAttack = false;
      this.selectedPlayerIndex = null;
      bus.emit(EVENTS.ACTION_USED, { playerIndex });
      bus.emit(EVENTS.CHARACTER_DESELECTED, { playerIndex });
    } else {
      this.playInvalidSound();
    }
  }

  private handleSkillTargetClick(coord: GridCoord): void {
    if (this.selectedPlayerIndex === null || !this.activeSkill) return;
    const caster = this.getCharacter(this.selectedPlayerIndex);
    if (!caster) return;

    // Clicking the caster's own tile cancels skill targeting (like ESC)
    if (coord.col === caster.coord.col && coord.row === caster.coord.row) {
      this.isTargetingSkill = false;
      this.activeSkill = null;
      bus.emit(EVENTS.SKILL_TARGETING_CANCELLED, { playerIndex: this.selectedPlayerIndex });
      this.showPanel(this.selectedPlayerIndex);
      return;
    }

    const dist = Math.abs(coord.col - caster.coord.col) + Math.abs(coord.row - caster.coord.row);
    const skill = this.activeSkill;

    // Resolve target based on skill's targetType
    let target: Character | undefined;
    if (skill.targetType === 'enemy') {
      target = this.getEnemyAtCoord(coord, caster.playerIndex);
    } else if (skill.targetType === 'ally') {
      target = this.getOwnCharacterAtCoord(coord);
    } else {
      // 'any': enemy takes priority, then own ally
      target = this.getEnemyAtCoord(coord, caster.playerIndex) ?? this.getOwnCharacterAtCoord(coord);
    }

    const extraValid = !this.canTargetWithSkill ||
      this.canTargetWithSkill(this.selectedPlayerIndex, skill.name, coord);

    if (target && dist <= skill.range && extraValid) {
      bus.emit(EVENTS.SKILL_HIT, { casterIndex: this.selectedPlayerIndex, skillName: skill.name, targetCoord: coord });
      caster.actionTokens -= 1;
      caster.moveTokens = 0;
      caster.updateTokenDisplay();
      const playerIndex = this.selectedPlayerIndex;
      this.isTargetingSkill = false;
      this.activeSkill = null;
      this.selectedPlayerIndex = null;
      bus.emit(EVENTS.ACTION_USED, { playerIndex });
      bus.emit(EVENTS.CHARACTER_DESELECTED, { playerIndex });
    } else {
      this.playInvalidSound();
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || this.selectedPlayerIndex === null) return;
    if (this.isTargetingAttack) {
      this.clearPreview();
      this.isTargetingAttack = false;
      bus.emit(EVENTS.ATTACK_TARGETING_CANCELLED, { playerIndex: this.selectedPlayerIndex });
      this.showPanel(this.selectedPlayerIndex);
    } else if (this.isTargetingSkill) {
      this.clearPreview();
      this.isTargetingSkill = false;
      this.activeSkill = null;
      bus.emit(EVENTS.SKILL_TARGETING_CANCELLED, { playerIndex: this.selectedPlayerIndex });
      this.showPanel(this.selectedPlayerIndex);
    } else {
      bus.emit(EVENTS.CHARACTER_DESELECTED, { playerIndex: this.selectedPlayerIndex });
      this.selectedPlayerIndex = null;
    }
  };

  private handleCharacterSelected = ({ playerIndex }: { playerIndex: number }): void => {
    this.playSelectSound();
    this.showPanel(playerIndex);
  };

  private handleCharacterDeselected = (): void => {
    this.clearPreview();
    this.isTargetingAttack = false;
    this.isTargetingSkill = false;
    this.activeSkill = null;
    this.hidePanel();
  };

  private handleTurnChanged = (): void => {
    this.clearPreview();
    this.isTargetingAttack = false;
    this.isTargetingSkill = false;
    this.activeSkill = null;
    this.hidePanel();
    this.selectedPlayerIndex = null;
  };

  private showPanel(playerIndex: number): void {
    const char = this.getCharacter(playerIndex);
    const exhausted = char?.actionTokens === 0;

    const title = this.actionPanel.querySelector('#action-panel-title') as HTMLParagraphElement;
    if (title && char) title.textContent = char.name;

    // Rebuild skill buttons for this character
    const skillsSlot = this.actionPanel.querySelector('#action-panel-skills') as HTMLDivElement;
    skillsSlot.innerHTML = '';
    for (const skill of char?.skills ?? []) {
      const btn = this.makeButton(skill.name, () => this.handleUseSkillClick(skill));
      btn.disabled = exhausted;
      btn.addEventListener('mouseenter', () => {
        if (this.selectedPlayerIndex === null) return;
        bus.emit(EVENTS.RANGE_PREVIEW_START, { playerIndex: this.selectedPlayerIndex, range: skill.range });
      });
      btn.addEventListener('mouseleave', () => {
        if (this.isTargetingAttack || this.isTargetingSkill) return;
        bus.emit(EVENTS.RANGE_PREVIEW_END, {});
      });
      skillsSlot.appendChild(btn);
    }

    // Disable all static buttons if exhausted
    this.actionPanel.querySelectorAll('button').forEach(btn => {
      (btn as HTMLButtonElement).disabled = exhausted;
    });

    this.actionPanel.style.display = 'flex';
  }

  private hidePanel(): void {
    this.actionPanel.style.display = 'none';
  }

  dispose(): void {
    bus.off(EVENTS.TILE_CLICKED, this.handleTileClicked);
    bus.off(EVENTS.TILE_HOVER_ENTER, this.handleTileHoverEnter);
    bus.off(EVENTS.TILE_HOVER_EXIT, this.handleTileHoverExit);
    bus.off(EVENTS.CHARACTER_SELECTED, this.handleCharacterSelected);
    bus.off(EVENTS.CHARACTER_DESELECTED, this.handleCharacterDeselected);
    bus.off(EVENTS.TURN_CHANGED, this.handleTurnChanged);
    bus.off(EVENTS.CANVAS_CLICKED_EMPTY, this.handleCanvasClickedEmpty);
    this.audioCtx?.close();
    window.removeEventListener('keydown', this.handleKeyDown);
    this.actionPanel.remove();
  }
}
