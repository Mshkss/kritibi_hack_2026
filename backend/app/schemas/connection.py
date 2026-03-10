"""Pydantic schemas for Connection layer."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ConnectionCreateRequest(BaseModel):
    """Create lane-level transition via node."""

    model_config = ConfigDict(extra="forbid")

    via_node_id: str
    from_edge_id: str
    to_edge_id: str
    from_lane_index: int = Field(ge=0)
    to_lane_index: int = Field(ge=0)
    uncontrolled: bool = False


class ConnectionPatchRequest(BaseModel):
    """Patch mutable connection fields."""

    model_config = ConfigDict(extra="forbid")

    uncontrolled: bool | None = None


class NodeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str


class EdgeConnectionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str | None = None
    from_node_id: str
    to_node_id: str
    num_lanes: int


class ConnectionResponse(BaseModel):
    """Connection DTO with optional editor summary fields."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    via_node_id: str
    from_edge_id: str
    to_edge_id: str
    from_lane_index: int
    to_lane_index: int
    uncontrolled: bool
    from_edge_code: str
    to_edge_code: str
    via_node_code: str
    from_edge_name: str | None = None
    to_edge_name: str | None = None
    created_at: datetime
    updated_at: datetime


class NodeConnectionsResponse(BaseModel):
    """Editor-friendly node connection payload."""

    model_config = ConfigDict(from_attributes=True)

    node: NodeSummary
    incoming_edges: list[EdgeConnectionSummary]
    outgoing_edges: list[EdgeConnectionSummary]
    connections: list[ConnectionResponse]


class ConnectionAutogenerateRequest(BaseModel):
    """Autogeneration configuration for one node."""

    model_config = ConfigDict(extra="forbid")

    add_missing_only: bool = True
    allow_u_turns: bool = False
    uncontrolled: bool = False


class ConnectionAutogenerateResponse(BaseModel):
    """Autogeneration result with created entities."""

    model_config = ConfigDict(from_attributes=True)

    node_id: str
    considered_pairs: int
    created_count: int
    skipped_duplicates: int
    skipped_u_turns: int
    created_connections: list[ConnectionResponse]
    diagnostics: list[str]


class ConnectionCandidatePair(BaseModel):
    """Valid incoming->outgoing pair candidate."""

    model_config = ConfigDict(from_attributes=True)

    from_edge_id: str
    from_edge_code: str
    to_edge_id: str
    to_edge_code: str
    is_u_turn: bool
    lane_mapping_count: int


class ConnectionInvalidPair(BaseModel):
    """Pair rejected for autogeneration with reason."""

    model_config = ConfigDict(from_attributes=True)

    from_edge_id: str
    from_edge_code: str
    to_edge_id: str
    to_edge_code: str
    reason: str


class ConnectionCandidatesResponse(BaseModel):
    """Diagnostics for possible node connection pairs."""

    model_config = ConfigDict(from_attributes=True)

    node_id: str
    incoming_edges: list[EdgeConnectionSummary]
    outgoing_edges: list[EdgeConnectionSummary]
    valid_pairs: list[ConnectionCandidatePair]
    invalid_pairs: list[ConnectionInvalidPair]
    diagnostics: list[str]
