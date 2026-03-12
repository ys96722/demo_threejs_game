# Project Overview

SRPG demo — a two-player, turn-based strategy game built with Vite + TypeScript (strict) + Three.js on the frontend and FastAPI + Python on the backend.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + TypeScript (strict) + Three.js |
| Post-processing | Three.js `EffectComposer` (Bloom via `UnrealBloomPass`) |
| Backend | FastAPI + Python, WebSocket via `websockets` |
| Testing (frontend) | Vitest (node environment, no browser) |
| Testing (backend) | pytest |

## Hosting

| Service | What it serves |
|---------|---------------|
| **GitHub Pages** | Static frontend at `yooniverse.me` |
| **Render** | FastAPI WebSocket server |

- `public/CNAME` contains `yooniverse.me`; Vite copies it into `dist/` so GH Pages picks it up automatically.
- GH Actions (`.github/workflows/deploy.yml`) builds and deploys to the `gh-pages` branch on every push to `main`.
- DNS: set a CNAME record `yooniverse.me → ys96722.github.io`, then enable the custom domain in repo Settings → Pages.

## Environment Variables

All runtime URL config is centralised in `src/config/env.ts`.

| Variable | Purpose | Default (dev) |
|----------|---------|---------------|
| `VITE_API_URL` | HTTP base for `/lobby/*` endpoints | `''` (uses Vite proxy → `localhost:8000`) |
| `VITE_WS_URL` | WebSocket base for `/ws/*` | `ws://localhost:host` (uses Vite proxy) |
| `VITE_BASE_PATH` | Vite `base` for asset paths | `'/'` |

Set `VITE_API_URL` and `VITE_WS_URL` as GitHub Actions secrets for production.

## Architecture Rules

- **Event-bus pattern.** All cross-system communication goes through `bus` (`src/core/EventBus.ts`). Events and payloads are defined in `src/types/events.ts`.
- **Pure logic in `src/logic/`.** Game mechanics (combat, movement, displacement, buffs) are pure functions with no Three.js, no DOM, no bus — fully unit-testable.
- **No direct mutation outside handlers.** All state changes happen inside bus event handlers so state can be replayed from an event log.
- **Serialisable event payloads.** Plain JSON only — no class instances, no Three.js objects — so payloads can be forwarded over the network as-is.

## Dev Setup

```bash
# Terminal 1 — FastAPI server
npm run server        # runs uvicorn on :8000

# Terminal 2 — Vite dev server
npm run dev           # opens browser at localhost:5173
```

Vite's dev proxy (`vite.config.ts`) routes `/lobby` and `/ws` to `localhost:8000`, so no CORS or URL config is needed locally.

## Deploy

1. Push to `main` → GH Actions runs `npm run build` and deploys `dist/` to the `gh-pages` branch.
2. Set repo secrets: `VITE_WS_URL=wss://…onrender.com`, `VITE_API_URL=https://…onrender.com`.
3. Set DNS CNAME `yooniverse.me → ys96722.github.io`; enable custom domain in repo Settings → Pages.
4. Deploy server to Render (uses `server/Procfile` for the start command — Render reads Procfiles automatically).

## Key Files

| Path | Purpose |
|------|---------|
| `src/config/env.ts` | Centralised `API_BASE` / `WS_BASE` constants |
| `src/config/gameConfig.ts` | All tunable game constants and character definitions |
| `src/core/Game.ts` | Scene graph, systems wiring, render loop, all state mutations |
| `src/core/EventBus.ts` | Typed pub/sub singleton (`bus`) |
| `src/types/events.ts` | `EVENTS` const + `EventPayloads` map |
| `src/lobby/LobbyScreen.ts` | Lobby UI — solo/PvP menu, create/join lobby, WebSocket handshake |
| `src/net/GameClient.ts` | In-game WebSocket client (relay and receive game events) |
| `server/main.py` | FastAPI app — lobby REST + WebSocket relay |
| `server/Procfile` | Render start command |
| `.github/workflows/deploy.yml` | GH Actions CI/CD → GH Pages |
| `public/CNAME` | Custom domain for GH Pages |

For full multiplayer architecture details see `MULTIPLAYER.md`.
For codebase file map see `CODEBASE.md`.
