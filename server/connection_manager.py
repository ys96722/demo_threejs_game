"""WebSocket connection registry.

Tracks the two WebSocket connections per lobby (one per team).
Provides helpers to send messages to one or both connections.
"""

from __future__ import annotations
import asyncio
import json
from fastapi import WebSocket


class LobbyConnections:
    def __init__(self) -> None:
        self.connections: dict[int, WebSocket] = {}  # team → WebSocket

    def add(self, team: int, ws: WebSocket) -> None:
        self.connections[team] = ws

    def remove(self, team: int) -> None:
        self.connections.pop(team, None)

    def is_full(self) -> bool:
        return len(self.connections) == 2

    async def send(self, team: int, msg: dict) -> None:
        ws = self.connections.get(team)
        if ws:
            await ws.send_text(json.dumps(msg))

    async def broadcast(self, msg: dict) -> None:
        """Send the same message to all connected clients."""
        payload = json.dumps(msg)
        tasks = [ws.send_text(payload) for ws in self.connections.values()]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def send_to_others(self, sender_team: int, msg: dict) -> None:
        payload = json.dumps(msg)
        for team, ws in self.connections.items():
            if team != sender_team:
                await ws.send_text(payload)


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[str, LobbyConnections] = {}

    def get_room(self, code: str) -> LobbyConnections:
        if code not in self._rooms:
            self._rooms[code] = LobbyConnections()
        return self._rooms[code]

    def close_room(self, code: str) -> None:
        self._rooms.pop(code, None)


# Singleton
connection_manager = ConnectionManager()
