"""Domain entity: Edge."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class Edge:
    id: UUID
