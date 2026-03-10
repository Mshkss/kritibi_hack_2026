"""Domain entity: IntersectionApproach."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class IntersectionApproach:
    id: UUID
    project_id: UUID
    intersection_id: UUID
    incoming_edge_id: UUID
    order_index: int | None
    name: str | None
    created_at: datetime
    updated_at: datetime
