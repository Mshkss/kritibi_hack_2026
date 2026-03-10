"""Project routes placeholder."""

from fastapi import APIRouter

router = APIRouter(prefix="/projects")


@router.get("/ping")
def ping_projects() -> dict[str, str]:
    return {"module": "projects", "status": "todo"}
