"""Domain entity: Intersection."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class Intersection:
    id: UUID
    project_id: UUID
    node_id: UUID
    kind: str
    name: str | None
    created_at: datetime
    updated_at: datetime
