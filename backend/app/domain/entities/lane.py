"""Domain entity: Lane."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class Lane:
    id: UUID
    edge_id: UUID
    index: int
    allow: str | None
    speed: float | None
    width: float | None
    created_at: datetime
    updated_at: datetime
