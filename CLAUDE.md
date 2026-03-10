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

TypeScript type-checking (`tsc --noEmit`) is the primary build correctness check, run implicitly by `npm run build`. Unit tests live in `src/logic/__tests__/` and run with `npm test` (Vitest, no browser needed).

## Architecture

**Entry point:** `src/main.ts` → instantiates `Game` and calls `game.start()`.

**Game (`src/core/Game.ts`)** owns the scene graph, all systems, and the render loop. It wires everything together via the event bus. Skill effects (damage, push, etc.) are implemented here since `Game` has access to the grid, characters, and `isOccupied`. Add a new `else if` branch in the `SKILL_HIT` handler for each new skill.

**Event-driven communication:** All cross-system communication goes through `bus` (singleton from `src/core/EventBus.ts`). Events and their payload types are defined in `src/types/events.ts` (`EVENTS` const + `EventPayloads` map). Add new events there first.

**Systems** (`src/systems/`) subscribe to bus events in their constructor and must call `bus.off(...)` in their `dispose()` method. Systems receive dependencies (grid, callbacks) injected from `Game` — they do not import `Game` directly.

- `SelectionSystem` — manages character selection state, action panel UI, attack/skill targeting modes, range preview on button hover, and Web Audio API sounds (no audio files; sounds are synthesized). Emits intent events only (`ATTACK_INTENT`, `SKILL_HIT`, `SPEND_ACTION_INTENT`); `Game.ts` applies all state changes.
- `MovementSystem` — validates movement on tile click and emits `MOVE_INTENT`; does not mutate character state.

**Entities** (`src/entities/`) are Three.js objects. `Character` owns a `THREE.Group` containing: a character `Sprite`, a selection glow `Sprite` (same texture, additive blending, HDR color for bloom, hidden until selected), a health bar sprite, and a token indicator sprite. Characters are not aware of the grid or bus directly.

Key `Character` methods: `setSelected(bool)` — shows/hides the bloom glow. `setTokensVisible(bool)` — tokens are only shown for the active player's characters. `setHp(value)` — clamps and redraws health bar. `updateTokenDisplay()` — redraws move/action token dots.

**Skills** — defined as `SkillDef { name: string; range: number; targetType: 'enemy' | 'ally' | 'any' }` in `src/types/characters.ts`. Characters carry a `skills: SkillDef[]` array in their config. `SelectionSystem` shows skill buttons by name in the action panel (rebuilt per character in `showPanel`). Effect logic lives in `Game.ts` dispatched by `skillName` in the `SKILL_HIT` handler.

**World** (`src/world/`) — `Grid` creates a 10×10 array of `Tile` objects. `Tile.gridToWorld()` converts `GridCoord → THREE.Vector3`: `x = (col - (cols-1)/2) * step`, `z = (row - (rows-1)/2) * step` where `step = tileSize + tileGap = 1.04`. Each tile mesh stores `mesh.userData['tile'] = this` for O(1) raycaster lookup. `GridVisuals` manages shared `MeshToonMaterial` instances per `TileState`.

**Config:** All tunable numbers (grid size, camera, VFX, movement timing) and character definitions (including skills) live in `src/config/gameConfig.ts`. Never hardcode magic numbers elsewhere.

**TypeScript strictness:** `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`. Systems held as class fields that subscribe to bus events satisfy the "unused" check by virtue of being fields — but they must expose `dispose()`.

**Post-processing:** `Game` uses Three.js `EffectComposer` (RenderPass → UnrealBloomPass → OutputPass). Call `composer.render()` instead of `renderer.render()` in the loop. The bloom threshold is 0.65 — use HDR color values (> 1.0 per channel) on `MeshBasicMaterial` or `SpriteMaterial` to guarantee bloom on emissive objects.

## Multiplayer

See **`MULTIPLAYER.md`** for the full multiplayer architecture reference — lobby flow, WebSocket protocol, `GameClient`, server file map, and future-work notes.

## Multiplayer Target Architecture

The long-term target is a two-player game where each player runs a **separate browser client** connected to a **shared authoritative server**. Keep the following in mind when making architectural decisions:

- **Events as the network primitive.** The event bus already decouples actions from side effects. In multiplayer, player-action events (`TILE_CLICKED`, `CHARACTER_SELECTED`, etc.) will be forwarded over the network and applied on all clients. Design event payloads to be serializable (plain JSON — no class instances, no Three.js objects).

- **Team = player session.** `character.team` maps directly to a connected player. `SelectionSystem.getOwnCharacterAtCoord` already encapsulates "only the local player can act on their own team's characters" — in multiplayer this becomes an authorization check: only emit actions for `localPlayerTeam`.

- **Keep game logic in `Game.ts` event handlers.** Skill effects, movement validation, and turn management all live in `Game.ts` and are driven purely by events. This keeps them portable to a server-side authoritative model without restructuring.

- **Avoid direct mutation outside events.** Never mutate character state or tile state outside of a bus event handler — this ensures all state changes can be replayed from an event log.

- **Local player concept.** When multiplayer is implemented, `Game` (or a future `GameClient`) will receive a `localTeam: number` at construction to gate which inputs are forwarded to the server.

## Pull Requests

Every PR must include before and after screenshots of the game screen. Run `npm run create-pr` to capture before/after screenshots, commit them, push the branch, and open the PR in one step. Pass `--title "…"` to set the PR title non-interactively.

**Keep docs current.** Both `CLAUDE.md` and `CODEBASE.md` must be updated in the same PR as any change that affects them:
- `CLAUDE.md` — update when architecture, commands, patterns, or conventions change
- `CODEBASE.md` — update when files are added/removed, system responsibilities change, event flow changes, character stats change, or new layers are introduced

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

## Testing

`npm test` runs Vitest in `node` environment — no browser, no Three.js, millisecond feedback.

**Philosophy:** All game logic lives in `src/logic/` as pure functions. Every function takes plain objects (structural interfaces — no Three.js, no Character class) and returns a plain value. Tests pass anonymous plain objects; no imports from rendering, DOM, or bus.

**`src/logic/` contract:**
- Use structural interfaces (e.g., `HasStrengthDefense`, `HasCoordTeam`) so tests can pass plain objects.
- No Three.js imports. No DOM. No `bus` imports.
- `Game.ts` and `SelectionSystem.ts` are thin wrappers that delegate to these functions.

**Full-coverage matrix rule:** Every mechanic must be tested against its full state space:
- **Combat:** strength > defense (damage), defense >= strength (floor 0), 0-strength attacker, high defense, 1-hp lethal, buffs stacking
- **Movement:** within range, at exact range, one beyond range, zero move tokens, own tile, occupied by enemy, occupied by ally, all four grid edges + off-grid
- **Displacement (push/pull):** valid push, enemy at grid edge, destination occupied, valid pull, destination occupied, target at edge on pull
- **Buffs:** correct stat modified, stacking

**Adding a new mechanic:**
1. Add the pure logic function to the appropriate file in `src/logic/`
2. Add a `describe` block in `src/logic/__tests__/` covering the full matrix
3. Wire the effect in `Game.ts` `SKILL_HIT` (or appropriate handler) delegating to the logic function
4. Run `npm test` — all cases must pass before opening a PR

**Future mechanics to anticipate:** debuffs (stat reduction), invincibility (block damage), range buffs (extend attackRange/moveRange), terrain effects, status effects (stun = 0 move tokens for N turns). Each needs a new function in `src/logic/` and a test matrix entry.

## Verification

### TypeScript
- `npm run build` — tsc + vite build; must compile clean
- `npm test` — Vitest; must pass all tests (currently 44)

### Python server
- `cd server && pip install -r requirements.txt`
- `cd server && pytest` — must pass all tests (currently 77)

### Manual E2E (multiplayer)
1. `npm run server` (terminal 1)
2. `npm run dev` (terminal 2)
3. Open two browser tabs at `http://localhost:5173`
4. Tab A: PvP → Create Lobby → note code
5. Tab B: PvP → Join Lobby → enter code
6. Both tabs show game board; Tab A is Team 1
7. Tab A moves a character → Tab B sees the animation
8. Tab A attacks → Tab B sees HP change
9. Turn passes to Tab B → Tab A input is blocked

### Solo (regression)
- Click "Quick Test" → existing game works identically (no server needed)
