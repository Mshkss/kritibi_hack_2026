"""Intersection routes placeholder."""

from fastapi import APIRouter

router = APIRouter(prefix="/intersections")


@router.get("/ping")
def ping_intersections() -> dict[str, str]:
    return {"module": "intersections", "status": "todo"}
