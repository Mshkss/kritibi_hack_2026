"""Domain entity: Node."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class Node:
    id: UUID
