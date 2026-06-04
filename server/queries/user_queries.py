"""Database query functions for users and characters."""

from __future__ import annotations

import logging

from queries.db import get_conn

logger = logging.getLogger(__name__)


def get_user_by_id(user_id: str) -> dict | None:
    logger.info("querying users table for id=%s", user_id)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            return cur.fetchone()


def get_characters_by_user_id(user_id: str) -> list[dict]:
    logger.info("querying user_characters table for user_id=%s", user_id)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.id, c.name
                FROM characters c
                JOIN user_characters uc ON uc.character_id = c.id
                WHERE uc.user_id = %s
            """, (user_id,))
            return cur.fetchall()
