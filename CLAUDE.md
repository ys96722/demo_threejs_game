# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at localhost:5173
npm run build      # Type-check (tsc) then bundle (vite build)
npm run preview    # Serve the production build
npm run screenshot # Capture a single screenshot (low-level utility)
npm run create-pr  # Capture before/after screenshots, commit, push, and open PR
```

There are no tests. TypeScript type-checking (`tsc --noEmit`) is the primary correctness check, run implicitly by `npm run build`.

## Architecture

**Entry point:** `src/main.ts` → instantiates `Game` and calls `game.start()`.

**Game (`src/core/Game.ts`)** owns the scene graph, all systems, and the render loop. It wires everything together via the event bus. Skill effects (damage, push, etc.) are implemented here since `Game` has access to the grid, characters, and `isOccupied`. Add a new `else if` branch in the `SKILL_HIT` handler for each new skill.

**Event-driven communication:** All cross-system communication goes through `bus` (singleton from `src/core/EventBus.ts`). Events and their payload types are defined in `src/types/events.ts` (`EVENTS` const + `EventPayloads` map). Add new events there first.

**Systems** (`src/systems/`) subscribe to bus events in their constructor and must call `bus.off(...)` in their `dispose()` method. Systems receive dependencies (grid, callbacks) injected from `Game` — they do not import `Game` directly.

- `SelectionSystem` — manages character selection state, action panel UI, attack/skill targeting modes, range preview on button hover, and Web Audio API sounds (no audio files; sounds are synthesized). Emits `SKILL_HIT` with `{ casterIndex, skillName, targetCoord }` after validating range; `Game` applies the effect.
- `MovementSystem` — validates and executes character movement on tile click.

**Entities** (`src/entities/`) are Three.js objects. `Character` owns a `THREE.Group` containing: a character `Sprite`, a selection glow `Sprite` (same texture, additive blending, HDR color for bloom, hidden until selected), a health bar sprite, and a token indicator sprite. Characters are not aware of the grid or bus directly.

Key `Character` methods: `setSelected(bool)` — shows/hides the bloom glow. `setTokensVisible(bool)` — tokens are only shown for the active player's characters. `setHp(value)` — clamps and redraws health bar. `updateTokenDisplay()` — redraws move/action token dots.

**Skills** — defined as `SkillDef { name: string; range: number }` in `src/types/characters.ts`. Characters carry a `skills: SkillDef[]` array in their config. `SelectionSystem` shows skill buttons by name in the action panel (rebuilt per character in `showPanel`). Effect logic lives in `Game.ts` dispatched by `skillName` in the `SKILL_HIT` handler.

**World** (`src/world/`) — `Grid` creates a 10×10 array of `Tile` objects. `Tile.gridToWorld()` converts `GridCoord → THREE.Vector3`: `x = (col - (cols-1)/2) * step`, `z = (row - (rows-1)/2) * step` where `step = tileSize + tileGap = 1.04`. Each tile mesh stores `mesh.userData['tile'] = this` for O(1) raycaster lookup. `GridVisuals` manages shared `MeshToonMaterial` instances per `TileState`.

**Config:** All tunable numbers (grid size, camera, VFX, movement timing) and character definitions (including skills) live in `src/config/gameConfig.ts`. Never hardcode magic numbers elsewhere.

**TypeScript strictness:** `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`. Systems held as class fields that subscribe to bus events satisfy the "unused" check by virtue of being fields — but they must expose `dispose()`.

**Post-processing:** `Game` uses Three.js `EffectComposer` (RenderPass → UnrealBloomPass → OutputPass). Call `composer.render()` instead of `renderer.render()` in the loop. The bloom threshold is 0.65 — use HDR color values (> 1.0 per channel) on `MeshBasicMaterial` or `SpriteMaterial` to guarantee bloom on emissive objects.

## Pull Requests

Every PR must include before and after screenshots of the game screen. Run `npm run create-pr` to capture before/after screenshots, commit them, push the branch, and open the PR in one step. Pass `--title "…"` to set the PR title non-interactively.

**When asked to create a PR and the current branch is `main`:**
1. Create a new branch with a short descriptive name (e.g. `feature/skill-system`, `fix/attack-range-preview`)
2. Stage and commit the relevant changes with clear, descriptive commit messages
3. Run `npm run create-pr -- --title "…" --body "…"` with a thorough description (see below)

**PR descriptions must be thorough.** Include:
- A bullet-point summary of every feature, fix, or refactor
- Why each change was made, not just what changed
- Any architectural decisions or new patterns introduced
- Known limitations or follow-up items if relevant

```bash
npm run create-pr -- \
  --title "Short descriptive title" \
  --body "$(cat <<'EOF'
## Summary

- Add X because Y; it lives in Z because it needs access to ...
- Refactor A so that B; previously this caused ...
- Fix bug where clicking outside the board did not deselect the character

## Architecture notes

- Skill effects are routed through SKILL_HIT so SelectionSystem stays decoupled from game logic

## Follow-up
- None
EOF
)"
```
