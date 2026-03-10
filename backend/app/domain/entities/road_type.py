"""Domain entity: RoadType."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class RoadType:
    id: UUID
    project_id: UUID
    code: str
    name: str | None
    num_lanes: int | None
    speed: float | None
    priority: int | None
    width: float | None
    sidewalk_width: float | None
    created_at: datetime
    updated_at: datetime
