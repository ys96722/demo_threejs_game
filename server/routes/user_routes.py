"""Route layer — user endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from services.user_service import user_service

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)


@router.get("/{user_id}/characters")
async def get_user_characters(user_id: str) -> JSONResponse:
    logger.info("GET /users/%s/characters", user_id)
    user = user_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    characters = user_service.get_characters_by_user_id(user_id)
    return JSONResponse(
        content={"user_id": user_id, "characters": characters},
        headers={"Cache-Control": "no-store"},
    )
