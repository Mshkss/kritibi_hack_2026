"""Node routes placeholder."""

from fastapi import APIRouter

router = APIRouter(prefix="/nodes")


@router.get("/ping")
def ping_nodes() -> dict[str, str]:
    return {"module": "nodes", "status": "todo"}
