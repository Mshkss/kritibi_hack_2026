"""Domain entity: Project."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class Project:
    id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
