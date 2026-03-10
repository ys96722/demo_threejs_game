# CODEBASE.md — Architecture Reference

A complete tour of the codebase for new contributors and for AI assistants working on this project.

---

## What It Is

A turn-based strategy RPG (SRPG) demo built with **Vite + TypeScript (strict mode) + Three.js**. Two teams of characters take turns moving and using skills on a 10×10 grid. Rendered with an orthographic camera, toon shading, and bloom post-processing.

---

## File Tree (`src/`)

```
src/
├── main.ts                        # Entry point — mounts LobbyScreen; on game-ready calls new Game(mode).start()
│
├── config/
│   └── gameConfig.ts              # All constants + character definitions
│
├── types/
│   ├── grid.ts                    # GridCoord, TileState enum
│   ├── events.ts                  # EVENTS const, EventPayloads map
│   └── characters.ts              # CharacterConfig, SkillDef, EffectPreview
│
├── core/
│   ├── EventBus.ts                # Typed pub/sub singleton (`bus`)
│   ├── Game.ts                    # Scene graph, systems, render loop, event handlers
│   ├── GameMode.ts                # Discriminated union: { kind: 'solo' } | { kind: 'pvp'; localTeam, ws }
│   └── TurnManager.ts             # Tracks whose turn it is; cycles teams
│
├── world/
│   ├── Grid.ts                    # 10×10 array of Tiles; occupied/valid queries
│   ├── Tile.ts                    # One cell: BoxGeometry, gridToWorld(), TileState
│   └── GridVisuals.ts             # Shared MeshToonMaterial pool per TileState
│
├── rendering/
│   ├── Renderer.ts                # WebGLRenderer, shadows, ResizeObserver
│   └── CameraController.ts        # OrthographicCamera, 80° elevation, 0° azimuth
│
├── entities/
│   ├── Character.ts               # THREE.Group: sprite, glow, health bar, token indicator
│   └── CharacterAnimator.ts       # Parabolic hop animation (easeInOutQuad)
│
├── input/
│   └── InputManager.ts            # mousemove/click → NDC → Raycaster → bus events
│
├── systems/
│   ├── SelectionSystem.ts         # Selection state, action panel UI, attack/skill targeting, sounds
│   └── MovementSystem.ts          # Validates movement on tile click; emits MOVE_INTENT only
│
├── lobby/
│   └── LobbyScreen.ts             # DOM state machine: MENU → PVP_MENU → WAITING → onGameReady(mode)
│
├── net/
│   ├── GameClient.ts              # Owns WebSocket; translates server messages to bus events + Character calls
│   └── protocol.ts                # TypeScript types for all WS messages (no runtime code)
│
└── logic/                         # Pure functions — no Three.js, no DOM, no bus
    ├── index.ts                   # Re-exports all logic functions
    ├── grid.ts                    # isValidCoord(), manhattanDist()
    ├── combat.ts                  # computeAttackDamage(), computeDisplaceDir(), validateDisplace()
    ├── movement.ts                # validateMovement()
    └── __tests__/
        ├── combat.test.ts
        ├── displacement.test.ts
        ├── grid.test.ts
        └── movement.test.ts

server/
├── main.py                        # FastAPI app; HTTP lobby endpoints; WebSocket dispatch
├── game_state.py                  # Authoritative GameState; apply_move/attack/skill/spend_action; turn mgmt
├── game_logic.py                  # Pure functions — port of src/logic/
├── lobby_manager.py               # In-memory lobby registry
├── connection_manager.py          # WebSocket registry per lobby
├── requirements.txt
└── tests/
    ├── test_game_logic.py         # Unit tests for pure logic functions (77 total)
    └── test_game_state.py         # Unit tests for GameState action handlers
```

---

## Layer-by-Layer Guide

### 1. Entry Point — `src/main.ts`
Two lines: instantiate `Game`, call `game.start()`. Nothing else lives here.

### 2. Config — `src/config/gameConfig.ts`
Single source of truth for **everything tunable**:
- `characters: CharacterConfig[]` — defines all four characters (see stats table below)
- `gameConfig` — grid size, camera frustum, movement animation timing, VFX bloom params, scene lighting

**Rule:** never hardcode magic numbers outside this file.

### 3. Types — `src/types/`
| File | Contents |
|------|----------|
| `grid.ts` | `GridCoord { col, row }`, `TileState` enum (`Normal`, `Hovered`, `Occupied`, `Reachable`, `AttackRange`, `SkillRange`, `Targeted`) |
| `events.ts` | `EVENTS` const (all event name strings) + `EventPayloads` map (event → payload type) |
| `characters.ts` | `CharacterConfig`, `SkillDef { name, range, targetType }`, `EffectPreview` union |

### 4. EventBus — `src/core/EventBus.ts`
Typed pub/sub singleton exported as `bus`. All cross-system communication goes through it. Payloads are plain JSON — no Three.js objects, no class instances (required for future multiplayer serialization).

```ts
bus.on(EVENTS.TILE_CLICKED, handler);   // subscribe
bus.emit(EVENTS.TILE_CLICKED, payload); // publish
bus.off(EVENTS.TILE_CLICKED, handler);  // unsubscribe (required in dispose())
```

### 5. World — `src/world/`
- **`Grid`** — creates the 10×10 `Tile` array, adds tile meshes to the scene, exposes `getTile(coord)`, `isOccupied(coord)`, `isValidCoord(coord)`.
- **`Tile`** — one cell. `gridToWorld()` converts `GridCoord → THREE.Vector3` using:
  `x = (col - (cols-1)/2) * step`, `z = (row - (rows-1)/2) * step`, `step = 1.04`
  Each tile mesh stores `mesh.userData['tile'] = this` for O(1) raycaster lookup.
- **`GridVisuals`** — maintains one `MeshToonMaterial` per `TileState`, shared across all tiles. Call `GridVisuals.applyState(tile, state)` to change tile appearance.

### 6. Rendering — `src/rendering/`
- **`Renderer`** — creates `WebGLRenderer` with shadows enabled, attaches a `ResizeObserver` to keep canvas and camera in sync. Emits `RENDERER_RESIZED`.
- **`CameraController`** — `OrthographicCamera` at 80° elevation, 0° azimuth. Frustum size from config.

Post-processing pipeline in `Game.ts`: `RenderPass → UnrealBloomPass → OutputPass`. Always call `composer.render()`, never `renderer.render()`. Bloom threshold is **0.65** — use HDR colors (channel value > 1.0) on `SpriteMaterial` / `MeshBasicMaterial` to bloom an object.

### 7. Entities — `src/entities/`
- **`Character`** — a `THREE.Group` containing four sprites stacked vertically:
  1. Character sprite (pixel art texture)
  2. Selection glow sprite (same texture, additive blending, HDR color — appears only when selected)
  3. Health bar sprite (redrawn via canvas on `setHp()`)
  4. Token indicator sprite (move/action dots, redrawn via canvas on `updateTokenDisplay()`)

  Key methods: `setSelected(bool)`, `setTokensVisible(bool)`, `setHp(value)`, `updateTokenDisplay()`.
  Characters have no knowledge of the grid or bus; state is pushed in from outside.

- **`CharacterAnimator`** — drives the parabolic hop animation. Takes `from` and `to` world positions; lerps with `easeInOutQuad` and adds a sine-based vertical arc (`hopHeight` from config).

### 8. Input — `src/input/InputManager.ts`
Listens to `mousemove` and `click` on the canvas. Converts to NDC, casts a ray via `THREE.Raycaster`, checks `mesh.userData['tile']`. Emits:
- `TILE_HOVER_ENTER` / `TILE_HOVER_EXIT` — when the cursor enters or leaves a tile
- `TILE_CLICKED` — when a tile is clicked
- `CANVAS_CLICKED_EMPTY` — when the click hits no tile

### 9. Systems — `src/systems/`
Systems subscribe to bus events in their constructor and **must** call `bus.off(...)` in `dispose()`. They receive dependencies injected from `Game` — they never import `Game` directly.

**`SelectionSystem`:**
- Manages which character is selected and what targeting mode is active (normal / attack / skill)
- Rebuilds the HTML action panel per selected character (`showPanel()`)
- Highlights reachable tiles, attack range tiles, and skill range tiles on hover
- Synthesizes Web Audio API sounds (no audio files)
- Emits **intent events only** — never mutates character state:
  - `SKILL_HIT { casterIndex, skillName, targetCoord }` after validating skill range
  - `SPEND_ACTION_INTENT { playerIndex }` when Transcend/Hold is clicked
- `Game.ts` applies all effects and token changes in its event handlers

**`MovementSystem`:**
- Listens for `TILE_CLICKED`; validates move range and occupancy
- Emits `MOVE_INTENT { characterIndex, from, to }` — does **not** mutate character state
- `Game.ts` applies the move (solo) or forwards to server (PvP)

### 10. Game — `src/core/Game.ts`
The wiring layer. Owns the scene graph, instantiates all systems, runs the `requestAnimationFrame` loop, and implements all event handlers that require cross-system access.

**Skill effect dispatch:** the `SKILL_HIT` handler switches on `skillName` and delegates to pure logic functions in `src/logic/`. Add a new `else if` branch here for each new skill.

**Turn management:** `TurnManager` cycles through unique team numbers. On `TURN_CHANGED`, `Game` updates which characters show tokens and resets move/action tokens.

### 11. Logic — `src/logic/`
Pure functions. No Three.js. No DOM. No `bus`. Every function takes structural interfaces and returns a plain value. This is the only layer covered by unit tests.

| File | Functions |
|------|-----------|
| `grid.ts` | `isValidCoord(coord, cols, rows)`, `manhattanDist(a, b)` |
| `movement.ts` | `validateMovement(char, dest, gridIsValid, occupied)` |
| `combat.ts` | `computeAttackDamage(attacker, target)`, `computeDisplaceDir(mover, target)`, `validateDisplace(caster, target, gridIsValid, occupied)` |

---

## Event Flow: A Complete Turn Action (Basic Attack)

```
Player clicks "Attack" button in the action panel
  └─ SelectionSystem enters attack-targeting mode
       └─ bus.emit(ATTACK_TARGETING_START, { playerIndex })

Player hovers over an enemy tile
  └─ InputManager → bus.emit(TILE_HOVER_ENTER, { coord })
       └─ SelectionSystem highlights tile as Targeted

Player clicks the enemy tile
  └─ InputManager → bus.emit(TILE_CLICKED, { coord })
       └─ SelectionSystem validates range (manhattanDist ≤ attackRange)
            └─ bus.emit(ATTACK_INTENT, { attackerIndex, targetCoord })
                 └─ Game.ts ATTACK_INTENT handler (solo):
                      1. finds attacker and target Character objects
                      2. calls computeAttackDamage(attacker, target) → damage
                      3. calls target.setHp(target.hp - damage)
                      4. decrements attacker.actionTokens, zeros moveTokens
                      5. bus.emit(ACTION_USED, { playerIndex: attackerIndex })
                           └─ Game.ts checks turn end → TurnManager.nextTurn() if all tokens spent
```

All payloads are plain JSON — serializable for multiplayer networking.

---

## Character Stats Reference

| Name | Team | HP | STR | INT | DEF | RES | MV | ATK Range | Skills |
|------|------|----|-----|-----|-----|-----|----|-----------|--------|
| Seonjae | 1 | 100 | 10 | 8 | 1 | 1 | 6 | 2 | Reveille of Black Cranes (range 3, ally) |
| Aerin | 1 | 90 | 7 | 3 | 3 | 2 | 5 | 1 | — |
| Mina | 2 | 100 | 1 | 1 | 1 | 1 | 4 | 1 | Abrazo o Desprecio (range 3, any) |
| Isma | 2 | 130 | 4 | 5 | 5 | 4 | 3 | 1 | — |

Stats are defined in `src/config/gameConfig.ts` → `characters` array. **Update this table whenever character stats change.**

Combat formula: `damage = max(0, attacker.strength − target.defense)`

---

## Suggested Deep-Dive Reading Order

1. `src/types/grid.ts` + `src/types/events.ts` — vocabulary of the whole system
2. `src/config/gameConfig.ts` — all the numbers
3. `src/core/EventBus.ts` — how communication works
4. `src/world/Tile.ts` → `src/world/Grid.ts` — the spatial data structure
5. `src/entities/Character.ts` — what a character looks like in the scene
6. `src/core/Game.ts` — how everything is wired together
7. `src/systems/SelectionSystem.ts` — the most complex system
8. `src/logic/*.ts` + `src/logic/__tests__/*.ts` — pure game logic and tests
