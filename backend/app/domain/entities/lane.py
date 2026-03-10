"""Domain entity: Lane."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class Lane:
    id: UUID
