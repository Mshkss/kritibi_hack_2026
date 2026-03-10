"""Domain entity: Node."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class Node:
    id: UUID
    project_id: UUID
    code: str
    x: float
    y: float
    type: str | None
    created_at: datetime
    updated_at: datetime
