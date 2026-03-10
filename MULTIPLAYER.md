# MULTIPLAYER.md — Architecture Reference

This file documents the multiplayer architecture for the SRPG demo. Read alongside `CODEBASE.md` for the full picture.

---

## Overview

Two browser clients connect over WebSocket to an authoritative **Python FastAPI server**. The server validates all actions and broadcasts state to both clients. The existing solo (`Game` class with no arguments) is completely preserved.

```
Browser A (Team 1)           FastAPI server            Browser B (Team 2)
─────────────────────        ────────────────────       ─────────────────────
LobbyScreen                  POST /lobby/create
  POST /lobby/create  →        → code "ABC123"
  ← { code }
  WS /ws/ABC123?team=1 ──────→ waits for guest ←────── POST /lobby/join { code }
                                                        ← { ok, team: 2 }
                                                        WS /ws/ABC123?team=2 ─→
                               both connected
                             ← GAME_START (team:1)     GAME_START (team:2) →
Game(pvp, team:1, ws)                                  Game(pvp, team:2, ws)
 user clicks → validate UI
 → MOVE/ATTACK/SKILL msg ───→ validate + mutate ──────→ STATE_UPDATE
 ← STATE_UPDATE ─────────────────────────────────────── STATE_UPDATE
 GameClient.applyStateUpdate()                          GameClient.applyStateUpdate()
```

---

## Running Locally

```bash
# Terminal 1 — Python server
cd server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — Vite dev server
npm run dev
```

Open `http://localhost:5173` in two browser tabs. The Vite dev proxy forwards `/lobby` and `/ws` to `localhost:8000`.

---

## File Map

### Frontend (TypeScript)

| File | Role |
|------|------|
| `src/core/GameMode.ts` | `GameMode` discriminated union: `{ kind: 'solo' }` or `{ kind: 'pvp'; localTeam, ws }` |
| `src/net/protocol.ts` | TypeScript types for every WS message — no runtime code |
| `src/net/GameClient.ts` | Owns the `WebSocket`; translates server messages to Character method calls and bus events |
| `src/lobby/LobbyScreen.ts` | DOM state machine: MENU → PVP_MENU → WAITING → calls `onGameReady(mode)` |
| `src/main.ts` | Mounts `LobbyScreen`; on game-ready, calls `new Game(mode).start()` |

### Backend (Python)

| File | Role |
|------|------|
| `server/main.py` | FastAPI app; HTTP lobby endpoints; WebSocket endpoint and message dispatch |
| `server/game_state.py` | Authoritative `GameState` dataclass; `apply_move / apply_attack / apply_skill`; turn management; `to_snapshot()` |
| `server/game_logic.py` | Pure functions — port of `src/logic/`: `validate_movement`, `compute_attack_damage`, `compute_displace_dir`, `validate_displace` |
| `server/lobby_manager.py` | In-memory lobby registry; `create / join / start_game / close` |
| `server/connection_manager.py` | WebSocket registry per lobby; `broadcast / send / send_to_others` |

---

## WebSocket Protocol

All messages are JSON with a `type` string discriminant.

### Client → Server

| `type` | Payload |
|--------|---------|
| `MOVE` | `{ characterIndex, from, to }` |
| `ATTACK` | `{ attackerIndex, targetCoord }` |
| `SKILL` | `{ casterIndex, skillName, targetCoord }` |
| `SPEND_ACTION` | `{ playerIndex }` |

### Server → Client

| `type` | Payload |
|--------|---------|
| `GAME_START` | `{ localTeam, initialState: GameStateSnapshot }` |
| `STATE_UPDATE` | `GameStateSnapshot` |
| `TURN_CHANGED` | `{ activeTeam, turnCount }` |
| `ACTION_REJECTED` | `{ reason }` |
| `GAME_OVER` | `{ winnerTeam }` |
| `OPPONENT_DISCONNECTED` | `{}` |

### GameStateSnapshot

```typescript
{
  characters: {
    playerIndex: number; team: number; coord: GridCoord;
    hp: number; defense: number; moveTokens: number; actionTokens: number;
  }[];
  activeTeam: number;
  turnCount: number;
}
```

---

## How `Game.ts` Changed

`Game` now accepts an optional `GameMode` constructor parameter (default `{ kind: 'solo' }`):

- `new Game()` → solo mode, behavior identical to before
- `new Game({ kind: 'pvp', localTeam: 1, ws })` → PvP mode

**Intent handlers gated on mode (pure command architecture):**

| Handler | Solo | PvP |
|---------|------|-----|
| `MOVE_INTENT` | Apply move locally (decrement token, call `moveTo`, emit `CHARACTER_MOVE_START`) | Send `MOVE` to server; emit `CHARACTER_DESELECTED` |
| `ATTACK_INTENT` | Apply damage locally, decrement tokens, emit `ACTION_USED` | Send `ATTACK` to server |
| `SKILL_HIT` | Apply skill effect + decrement tokens + emit `ACTION_USED` | Send `SKILL` to server |
| `SPEND_ACTION_INTENT` | Decrement action token, zero move token, emit `ACTION_USED` | Send `SPEND_ACTION` to server |

`MovementSystem` and `SelectionSystem` emit **intent events only** — they never mutate character state. All mutations happen in `Game.ts` event handlers (solo) or are confirmed via `GameClient.applyStateUpdate()` (PvP).

**`ACTION_USED` and `CHARACTER_MOVE_END`** — `checkTurnEnd()` is only called in solo mode. In PvP, the server sends `TURN_CHANGED`.

**`activeTeam` field** — tracks whose turn it is. In solo mode updated by `TurnManager.nextTurn()`. In PvP updated by `GameClient` forwarding the server's `TURN_CHANGED` event to the bus.

---

## How `GameClient.ts` Works

`GameClient` is constructed inside `Game` when `mode.kind === 'pvp'`. It receives the raw `WebSocket` and the `characters` Map.

- **`send(msg)`** — serializes and sends a client message
- **`applyStateUpdate(snapshot)`** — for each character: if coord changed → call `char.moveTo()` and emit `CHARACTER_MOVE_START`; always set `hp`, `defense`, `moveTokens`, `actionTokens`, `updateTokenDisplay()`
- **`TURN_CHANGED`** from server → `bus.emit(EVENTS.TURN_CHANGED, { player, turnCount })` → `Game.ts` handler updates DOM and resets tokens

---

## How New Skills Are Added (PvP)

1. Add the skill definition to `SKILL_DEFS` in `server/game_state.py`
2. Add the effect logic to `GameState.apply_skill()` in `server/game_state.py`
3. Add the client-side effect (if any visual preview is needed) to `Game.ts` → `SKILL_HIT` solo branch and the `getSkillPreview` callback in `SelectionSystem` constructor
4. Add the skill to the appropriate character in both `src/config/gameConfig.ts` and `server/game_state.py → build_initial_game_state()`
5. Add tests to `src/logic/__tests__/` if new pure-logic functions are needed

---

## Future Work

| Feature | Notes |
|---------|-------|
| **MMR matchmaking** | `POST /queue/join` endpoint; background loop pairs players by `±100` rating; replaces the share-code lobby with an auto-match lobby |
| **3v3 characters** | Add 2 more `CharacterConfig` entries per team in `gameConfig.ts` and `build_initial_game_state()`. `checkTurnEnd` already handles N chars. Zero structural change. |
| **Reconnection** | Store `GameState` by lobby code; on reconnect send full `STATE_UPDATE` snapshot |
| **Persistence** | Replace in-memory dicts in `lobby_manager.py` with Redis or SQLite |
| **Campaign mode** | Separate `CampaignGame` mode; scripted AI uses `src/logic/` functions as the decision engine |
| **Player accounts** | Required for persistent MMR; anonymous sessions (current) are sufficient for share-code play |
