"""Domain entity: Connection."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class Connection:
    id: UUID
