"""In-memory lobby registry.

A lobby is created by one player (team 1) and joined by another (team 2).
Once both WebSocket connections are established, the game begins.
"""

from __future__ import annotations
import secrets
from dataclasses import dataclass, field
from typing import Optional

from game_state import GameState, build_initial_game_state


@dataclass
class LobbyState:
    code: str
    game_state: Optional[GameState] = None
    # Tracks which team slots are reserved (before WS connects)
    team1_reserved: bool = True   # creator always gets team 1
    team2_reserved: bool = False
    # WebSocket connection objects are stored in ConnectionManager, not here


class LobbyManager:
    def __init__(self) -> None:
        self._lobbies: dict[str, LobbyState] = {}

    def create(self) -> str:
        """Generate a unique 6-character lobby code and register an empty lobby."""
        for _ in range(20):
            code = secrets.token_urlsafe(4)[:6].upper()
            if code not in self._lobbies:
                self._lobbies[code] = LobbyState(code=code)
                return code
        raise RuntimeError("Could not generate a unique lobby code")

    def join(self, code: str) -> tuple[bool, str, int]:
        """
        Attempt to join a lobby.
        Returns (ok, error_message, assigned_team).
        """
        lobby = self._lobbies.get(code)
        if not lobby:
            return False, "Lobby not found", 0
        if lobby.team2_reserved:
            return False, "Lobby is full", 0
        lobby.team2_reserved = True
        return True, "", 2

    def get(self, code: str) -> Optional[LobbyState]:
        return self._lobbies.get(code)

    def start_game(self, code: str) -> GameState:
        """Build and store the initial GameState for a lobby."""
        lobby = self._lobbies[code]
        lobby.game_state = build_initial_game_state()
        return lobby.game_state

    def close(self, code: str) -> None:
        self._lobbies.pop(code, None)


# Singleton — shared across all requests in the same process
lobby_manager = LobbyManager()
