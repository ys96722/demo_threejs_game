"""FastAPI server — lobby management and authoritative WebSocket game loop."""

from __future__ import annotations

import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from lobby_manager import lobby_manager
from connection_manager import connection_manager

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://yooniverse.me",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# HTTP endpoints
# ---------------------------------------------------------------------------

@app.post("/lobby/create")
async def create_lobby() -> dict:
    code = lobby_manager.create()
    return {"code": code}


class JoinRequest(BaseModel):
    code: str


@app.post("/lobby/join")
async def join_lobby(body: JoinRequest) -> dict:
    ok, error, team = lobby_manager.join(body.code.strip().upper())
    if not ok:
        return {"ok": False, "error": error}
    return {"ok": True, "team": team}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/{code}")
async def websocket_endpoint(ws: WebSocket, code: str, team: int) -> None:
    if team not in (1, 2):
        await ws.close(code=4003, reason="Invalid team")
        return
    code = code.upper()
    lobby = lobby_manager.get(code)
    if not lobby:
        await ws.close(code=4004, reason="Lobby not found")
        return

    await ws.accept()
    room = connection_manager.get_room(code)
    room.add(team, ws)

    try:
        # Once both players are connected, start the game
        if room.is_full():
            game_state = lobby_manager.start_game(code)
            snapshot = game_state.to_snapshot()

            await room.send(1, {"type": "GAME_START", "payload": {"localTeam": 1, "initialState": snapshot}})
            await room.send(2, {"type": "GAME_START", "payload": {"localTeam": 2, "initialState": snapshot}})

        # Game loop: receive action messages from this client
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            await handle_action(code, team, msg)

    except WebSocketDisconnect:
        room.remove(team)
        await room.broadcast({"type": "OPPONENT_DISCONNECTED", "payload": {}})
        if not room.connections:
            connection_manager.close_room(code)
            lobby_manager.close(code)


# ---------------------------------------------------------------------------
# Action handler
# ---------------------------------------------------------------------------

async def handle_action(code: str, team: int, msg: dict) -> None:
    room = connection_manager.get_room(code)
    msg_type = msg.get("type", "")
    payload = msg.get("payload", {})

    if msg_type == "CHAT":
        text = payload.get("text", "").strip()[:200]
        if text:
            await room.broadcast({"type": "CHAT", "payload": {"team": team, "text": text}})
        return

    lobby = lobby_manager.get(code)
    if not lobby or not lobby.game_state:
        return

    gs = lobby.game_state
    error: str | None = None

    if msg_type == "MOVE":
        char_index = payload.get("characterIndex")
        to = payload.get("to", {})
        error = gs.apply_move(char_index, to.get("col", 0), to.get("row", 0))

    elif msg_type == "ATTACK":
        attacker_index = payload.get("attackerIndex")
        target = payload.get("targetCoord", {})
        error = gs.apply_attack(attacker_index, target.get("col", 0), target.get("row", 0))

    elif msg_type == "SKILL":
        caster_index = payload.get("casterIndex")
        skill_name = payload.get("skillName", "")
        target = payload.get("targetCoord", {})
        error = gs.apply_skill(caster_index, skill_name, target.get("col", 0), target.get("row", 0))

    elif msg_type == "SPEND_ACTION":
        char_index = payload.get("playerIndex")
        error = gs.apply_spend_action(char_index)

    else:
        return  # unknown message type — ignore

    if error:
        await room.send(team, {"type": "ACTION_REJECTED", "payload": {"reason": error}})
        return

    # Check game over before broadcasting state
    winner = gs.check_game_over()
    if winner is not None:
        await room.broadcast({"type": "GAME_OVER", "payload": {"winnerTeam": winner}})
        return

    # Broadcast updated state to both clients
    await room.broadcast({"type": "STATE_UPDATE", "payload": gs.to_snapshot()})

    # Check if the active team's turn is over
    if gs.check_turn_end():
        gs.next_turn()
        await room.broadcast({
            "type": "TURN_CHANGED",
            "payload": {"activeTeam": gs.active_team, "turnCount": gs.turn_count},
        })
        # Send updated state with reset tokens
        await room.broadcast({"type": "STATE_UPDATE", "payload": gs.to_snapshot()})
