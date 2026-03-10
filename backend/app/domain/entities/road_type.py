"""Domain entity: RoadType."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class RoadType:
    id: UUID
