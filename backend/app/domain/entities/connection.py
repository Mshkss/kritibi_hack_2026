"""Domain entity: Connection."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class Connection:
    id: UUID
    project_id: UUID
    via_node_id: UUID
    from_edge_id: UUID
    to_edge_id: UUID
    from_lane_index: int
    to_lane_index: int
    uncontrolled: bool
