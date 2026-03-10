"""Healthcheck routes."""

from fastapi import APIRouter

router = APIRouter(prefix="", tags=["health"])


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
