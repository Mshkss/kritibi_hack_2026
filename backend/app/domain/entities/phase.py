"""Domain entity: Phase."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class Phase:
    id: UUID
