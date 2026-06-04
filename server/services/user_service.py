"""Service layer — user business logic orchestration.

Sits between the route layer and the query layer:
  routes → user_service → queries (db calls)

Does not import FastAPI or any HTTP primitives.
Does not execute raw SQL — delegates all persistence to the query layer.
"""

from __future__ import annotations

import logging

import queries.user_queries as user_queries

logger = logging.getLogger(__name__)


class UserService:
    def get_user_by_id(self, user_id: str) -> dict | None:
        logger.info("fetching user %s", user_id)
        return user_queries.get_user_by_id(user_id)

    def get_characters_by_user_id(self, user_id: str) -> list[dict]:
        logger.info("fetching characters for user %s", user_id)
        return user_queries.get_characters_by_user_id(user_id)


# Singleton — import and use this in route handlers
user_service = UserService()
