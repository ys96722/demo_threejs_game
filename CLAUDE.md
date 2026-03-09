# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at localhost:5173
npm run build      # Type-check (tsc) then bundle (vite build)
npm run preview    # Serve the production build
npm run screenshot # Capture before/after screenshots via Playwright
```

There are no tests. TypeScript type-checking (`tsc --noEmit`) is the primary correctness check, run implicitly by `npm run build`.

## Architecture

**Entry point:** `src/main.ts` → instantiates `Game` and calls `game.start()`.

**Game (`src/core/Game.ts`)** owns the scene graph, all systems, and the render loop. It wires everything together via the event bus.

**Event-driven communication:** All cross-system communication goes through `bus` (singleton from `src/core/EventBus.ts`). Events and their payload types are defined in `src/types/events.ts` (`EVENTS` const + `EventPayloads` map). Add new events there first.

**Systems** (`src/systems/`) subscribe to bus events in their constructor and must call `bus.off(...)` in their `dispose()` method. Systems receive dependencies (grid, callbacks) injected from `Game` — they do not import `Game` directly.

**Entities** (`src/entities/`) are pure Three.js objects. `Character` owns a `THREE.Group`, an `CharacterAnimator`, and VFX meshes. `characterParts.ts` contains factory functions for each body/VFX part. Characters are not aware of the grid or bus.

**World** (`src/world/`) — `Grid` creates an 8×8 array of `Tile` objects and adds them to the scene. `Tile.gridToWorld()` converts `GridCoord → THREE.Vector3`. Each tile mesh stores `mesh.userData['tile'] = this` for O(1) raycaster lookup. `GridVisuals` manages shared `MeshToonMaterial` instances per `TileState`.

**Config:** All tunable numbers (grid size, camera, VFX, movement timing) live in `src/config/gameConfig.ts` as a `const` object. Never hardcode magic numbers elsewhere.

**TypeScript strictness:** `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`. Systems held as class fields that subscribe to bus events satisfy the "unused" check by virtue of being fields — but they must expose `dispose()`.

**Post-processing:** `Game` uses Three.js `EffectComposer` (RenderPass → UnrealBloomPass → OutputPass). Call `composer.render()` instead of `renderer.render()` in the loop.

**Coordinate system:** Grid is centered at origin. World position: `x = (col - 3.5) * 1.04`, `z = (row - 3.5) * 1.04`. See `Tile.gridToWorld()`.

## Pull Requests

Every PR must include before and after screenshots of the game screen. Attach them in the PR description under a "## Screenshots" section with "Before" and "After" labels. Use `npm run screenshot` to capture them.
