"""Domain entity: Movement."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class Movement:
    id: UUID
    project_id: UUID
    intersection_id: UUID
    approach_id: UUID
    connection_id: UUID
    from_edge_id: UUID
    to_edge_id: UUID
    from_lane_index: int
    to_lane_index: int
    is_enabled: bool
    movement_kind: str | None
    created_at: datetime
    updated_at: datetime
