"""Domain entity: Intersection."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class Intersection:
    id: UUID
