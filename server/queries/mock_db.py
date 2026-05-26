"""Mock in-memory database tables.

Replaces a real DB during early development.
Each table is a list of dicts that mirrors the shape of the eventual DB rows.
Swap these out for real query functions when a DB is added.
"""

from __future__ import annotations

UserTable: list[dict] = [
    {"id": 1, "name": "yoon"},
    {"id": 2, "name": "liam"},
]

CharacterTable: list[dict] = [
    {"id": 1, "name": "Seonjae"},
    {"id": 2, "name": "Aerin"},
    {"id": 3, "name": "Astraea"},
]

# Junction table — which characters each user owns
UserCharacterTable: list[dict] = [
    {"user_id": 1, "character_id": 1},  # yoon → Seonjae
    {"user_id": 1, "character_id": 2},  # yoon → Aerin
    {"user_id": 2, "character_id": 2},  # liam → Aerin
    {"user_id": 2, "character_id": 3},  # liam → Astraea
]
