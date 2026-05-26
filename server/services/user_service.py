"""Service layer — user business logic orchestration.

Sits between the route layer and the query layer:
  routes → user_service → queries (db calls)

Does not import FastAPI or any HTTP primitives.
Does not execute raw SQL — delegates all persistence to the query layer.
"""

from __future__ import annotations

from queries.mock_db import UserCharacterTable, CharacterTable


class UserService:
    def get_characters_by_user_id(self, user_id: int) -> list[dict]:
        """Return all characters owned by the given user."""
        owned_ids = {
            row["character_id"]
            for row in UserCharacterTable
            if row["user_id"] == user_id
        }
        return [char for char in CharacterTable if char["id"] in owned_ids]


# Singleton — import and use this in route handlers
user_service = UserService()
