"""Domain entity: TrafficSign."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class TrafficSign:
    id: UUID
    project_id: UUID
    intersection_id: UUID | None
    approach_id: UUID | None
    node_id: UUID | None
    edge_id: UUID | None
    sign_type: str
    generated: bool
    metadata: dict[str, object] | None
    created_at: datetime
    updated_at: datetime
