"""Shared PostgreSQL connection — import `get_conn` wherever you need DB access."""

from __future__ import annotations

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

_url: str = os.environ["DATABASE_URL"]


def get_conn() -> psycopg2.extensions.connection:
    conn = psycopg2.connect(_url, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn
