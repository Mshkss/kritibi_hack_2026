"""Domain entity: Movement."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class Movement:
    id: UUID
