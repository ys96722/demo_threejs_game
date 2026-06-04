# demo_threejs_game

A two-player, turn-based SRPG demo built with Vite + TypeScript + Three.js on the frontend and FastAPI + Python on the backend. Play solo or against a friend over WebSocket.

Live at [yooniverse.me](https://yooniverse.me)

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |
| Python | 3.9.x |
| pip | 24.x (pip 25+ does not support Python 3.9) |

> **pip note:** If your pip is version 25+, downgrade it before installing Python dependencies:
> ```bash
> python -m pip install pip==24.3.1
> ```
> Always use `python -m pip` (not bare `pip`) to ensure packages install into the correct Python.

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/ys96722/demo_threejs_game.git
cd demo_threejs_game
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
cd server
pipenv install
cd ..
```

> If `pipenv` is not installed: `pip install pipenv`

### 4. Set up database credentials

Create a `server/.env` file with your Supabase database connection string:

```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

Get the connection string from your [Supabase dashboard](https://supabase.com/dashboard) under **Connect → URI**.

> `server/.env` is gitignored — never commit it.

---

## Running locally

Open two terminals from the repo root.

**Terminal 1 — Python backend**

```bash
cd server && python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Vite frontend**

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The Vite dev proxy automatically forwards `/lobby` and `/ws` requests to `localhost:8000` — no extra config needed.

---

## Playing the game

### Solo (no server needed)
Click **Quick Test** from the main menu. The full game runs client-side with no backend.

### PvP (requires the server)
1. Start both the backend and frontend as above.
2. Open [http://localhost:5173](http://localhost:5173) in **two browser tabs**.
3. Tab A: click **PvP → Create Lobby**, note the lobby code.
4. Tab B: click **PvP → Join Lobby**, enter the code.
5. Both tabs enter the game — Tab A is Team 1.

---

## Other commands

```bash
npm run build      # Type-check (tsc) then bundle (vite build)
npm run preview    # Serve the production build locally
npm test           # Run frontend unit tests (Vitest, no browser needed)
npm run create-pr  # Capture before/after screenshots, commit, push, and open a PR
```

### Backend tests

```bash
cd server
python -m pytest
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + TypeScript (strict) + Three.js |
| Post-processing | Three.js EffectComposer (bloom via UnrealBloomPass) |
| Backend | FastAPI + Python 3.9, WebSocket via `websockets` |
| Database | Supabase (PostgreSQL) |
| Frontend tests | Vitest (node environment) |
| Backend tests | pytest |
| Hosting (frontend) | GitHub Pages at `yooniverse.me` |
| Hosting (backend) | Render |
