"""Route layer — user endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from services.user_service import user_service
from queries.mock_db import UserTable

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/characters")
async def get_user_characters(user_id: int) -> JSONResponse:
    user = next((u for u in UserTable if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    characters = user_service.get_characters_by_user_id(user_id)
    return JSONResponse(
        content={"user_id": user_id, "characters": characters},
        headers={"Cache-Control": "no-store"},
    )
