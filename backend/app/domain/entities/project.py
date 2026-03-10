"""Domain entity: Project."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class Project:
    id: UUID
