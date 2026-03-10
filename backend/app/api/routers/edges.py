"""Edge routes placeholder."""

from fastapi import APIRouter

router = APIRouter(prefix="/edges")


@router.get("/ping")
def ping_edges() -> dict[str, str]:
    return {"module": "edges", "status": "todo"}
