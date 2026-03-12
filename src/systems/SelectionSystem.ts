import { bus } from '../core/EventBus';
import { EVENTS } from '../types/events';
import type { Character } from '../entities/Character';
import type { EffectPreview, SkillDef } from '../types/characters';
import type { GridCoord } from '../types/grid';
import { computeAttackDamage } from '../logic/combat';
import { playSelectSound, playInvalidSound } from '../audio/GameSfx';

export class SelectionSystem {
  private selectedPlayerIndex: number | null = null;
  private isTargetingAttack: boolean = false;
  private isTargetingSkill: boolean = false;
  private activeSkill: SkillDef | null = null;
  private actionPanel: HTMLDivElement;
  private previewTargetIndex: number | null = null;
  private previewTargetTeam: number | null = null;

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
    btn.className = 'at-btn-sm';
    btn.addEventListener('click', onClick);
    return btn;
  }

  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.id = 'action-panel';
    panel.style.display = 'none';

    const title = document.createElement('p');
    title.id = 'action-panel-title';
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
    skillsSlot.style.display = 'contents';
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

  // Other actions spend the action token via intent — Game.ts applies the effect.
  private handleActionClick(): void {
    if (this.selectedPlayerIndex === null) return;
    const char = this.getCharacter(this.selectedPlayerIndex);
    if (!char || char.actionTokens === 0) return;
    const playerIndex = this.selectedPlayerIndex;
    this.selectedPlayerIndex = null;
    bus.emit(EVENTS.SPEND_ACTION_INTENT, { playerIndex });
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
      if (char && char.moveTokens > 0) playInvalidSound();
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
      this.previewTargetTeam = enemy.team;
      bus.emit(EVENTS.TARGET_PREVIEW_START, { targetPlayerIndex: enemy.playerIndex, targetTeam: enemy.team, preview: { type: 'damage', amount: damage } });
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
      this.previewTargetTeam = target.team;
      bus.emit(EVENTS.TARGET_PREVIEW_START, { targetPlayerIndex: target.playerIndex, targetTeam: target.team, preview });
    }
  };

  private handleTileHoverExit = (_: { coord: GridCoord }): void => {
    this.clearPreview();
  };

  private clearPreview(): void {
    if (this.previewTargetIndex !== null && this.previewTargetTeam !== null) {
      bus.emit(EVENTS.TARGET_PREVIEW_END, { targetPlayerIndex: this.previewTargetIndex, targetTeam: this.previewTargetTeam });
      this.previewTargetIndex = null;
      this.previewTargetTeam = null;
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
      const playerIndex = this.selectedPlayerIndex;
      this.isTargetingAttack = false;
      this.selectedPlayerIndex = null;
      // Emit intent — Game.ts applies damage (solo) or forwards to server (PvP)
      bus.emit(EVENTS.ATTACK_INTENT, { attackerIndex: attacker.playerIndex, targetCoord: coord });
      bus.emit(EVENTS.CHARACTER_DESELECTED, { playerIndex });
    } else {
      playInvalidSound();
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
      const playerIndex = this.selectedPlayerIndex;
      this.isTargetingSkill = false;
      this.activeSkill = null;
      this.selectedPlayerIndex = null;
      bus.emit(EVENTS.SKILL_HIT, { casterIndex: playerIndex, skillName: skill.name, targetCoord: coord });
      bus.emit(EVENTS.CHARACTER_DESELECTED, { playerIndex });
    } else {
      playInvalidSound();
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (document.activeElement?.tagName === 'INPUT') return;
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
    playSelectSound();
    this.showPanel(playerIndex);
  };

  private handleCharacterDeselected = (): void => {
    this.clearPreview();
    this.isTargetingAttack = false;
    this.isTargetingSkill = false;
    this.activeSkill = null;
    this.selectedPlayerIndex = null;
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
    window.removeEventListener('keydown', this.handleKeyDown);
    this.actionPanel.remove();
  }
}
