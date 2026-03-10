"""Domain entity: PedestrianCrossing."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class PedestrianCrossing:
    id: UUID
    project_id: UUID
    intersection_id: UUID
    approach_id: UUID | None
    side_key: str
    is_enabled: bool
    name: str | None
    crossing_kind: str | None
    created_at: datetime
    updated_at: datetime
