"""Schemas for intersection editor layer."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


IntersectionKind = Literal["crossroad", "roundabout"]


class IntersectionCreateRequest(BaseModel):
    """Create intersection config over existing node."""

    model_config = ConfigDict(extra="forbid")

    node_id: str
    kind: IntersectionKind = "crossroad"
    name: str | None = Field(default=None, max_length=512)
    auto_sync: bool = True


class IntersectionPatchRequest(BaseModel):
    """Patch mutable intersection metadata."""

    model_config = ConfigDict(extra="forbid")

    kind: IntersectionKind | None = None
    name: str | None = Field(default=None, max_length=512)


class IntersectionResponse(BaseModel):
    """Intersection DTO."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    node_id: str
    kind: IntersectionKind
    name: str | None = None
    created_at: datetime
    updated_at: datetime


class IntersectionNodeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    x: float
    y: float
    type: str | None = None


class IntersectionEdgeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str | None = None
    from_node_id: str
    to_node_id: str
    num_lanes: int


class IntersectionApproachResponse(BaseModel):
    """Approach DTO."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    intersection_id: str
    incoming_edge_id: str
    incoming_edge_code: str
    incoming_edge_name: str | None = None
    order_index: int | None = None
    name: str | None = None
    created_at: datetime
    updated_at: datetime


class MovementResponse(BaseModel):
    """Movement DTO."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    intersection_id: str
    approach_id: str
    connection_id: str
    from_edge_id: str
    to_edge_id: str
    from_lane_index: int
    to_lane_index: int
    is_enabled: bool
    movement_kind: str | None = None
    created_at: datetime
    updated_at: datetime


class MovementPatchRequest(BaseModel):
    """Patch movement enabled/metadata fields."""

    model_config = ConfigDict(extra="forbid")

    is_enabled: bool | None = None
    movement_kind: str | None = Field(default=None, max_length=128)


class ApproachesSyncRequest(BaseModel):
    """Approach sync options."""

    model_config = ConfigDict(extra="forbid")

    add_missing_only: bool = True
    remove_stale: bool = False


class ApproachesSyncResponse(BaseModel):
    """Approach sync result."""

    model_config = ConfigDict(from_attributes=True)

    intersection_id: str
    created_count: int
    deleted_count: int
    stale_count: int
    approaches: list[IntersectionApproachResponse]
    diagnostics: list[str]


class MovementsSyncRequest(BaseModel):
    """Movement sync options."""

    model_config = ConfigDict(extra="forbid")

    add_missing_only: bool = True
    remove_stale: bool = False
    default_is_enabled: bool = True


class MovementsSyncResponse(BaseModel):
    """Movement sync result."""

    model_config = ConfigDict(from_attributes=True)

    intersection_id: str
    created_count: int
    updated_count: int
    deleted_count: int
    stale_count: int
    movements: list[MovementResponse]
    diagnostics: list[str]


class IntersectionValidationResponse(BaseModel):
    """Intersection consistency diagnostics."""

    model_config = ConfigDict(from_attributes=True)

    intersection_id: str
    is_valid: bool
    empty_approaches: list[str]
    missing_movements: list[str]
    stale_movements: list[str]
    warnings: list[str]
    errors: list[str]


class IntersectionEditorResponse(BaseModel):
    """Full editor payload for intersection UI."""

    model_config = ConfigDict(from_attributes=True)

    intersection: IntersectionResponse
    node: IntersectionNodeSummary
    incoming_edges: list[IntersectionEdgeSummary]
    outgoing_edges: list[IntersectionEdgeSummary]
    approaches: list[IntersectionApproachResponse]
    movements: list[MovementResponse]
    diagnostics: IntersectionValidationResponse
