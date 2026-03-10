"""Traffic lights routes placeholder."""

from fastapi import APIRouter

router = APIRouter(prefix="/traffic-lights")


@router.get("/ping")
def ping_traffic_lights() -> dict[str, str]:
    return {"module": "traffic_lights", "status": "todo"}
