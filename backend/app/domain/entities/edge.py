"""Domain entity: Edge."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class Edge:
    id: UUID
    project_id: UUID
    code: str
    from_node_id: UUID
    to_node_id: UUID
    road_type_id: UUID | None
    name: str | None
    speed: float | None
    priority: int | None
    length: float | None
    width: float | None
    sidewalk_width: float | None
    shape: list[dict[str, float]]
    created_at: datetime
    updated_at: datetime
