"""Schemas for intersection editor, priority, and sign layers."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


IntersectionKind = Literal["crossroad", "roundabout"]
ApproachRole = Literal["main", "secondary"]
TrafficSignType = Literal["main_road", "yield", "stop"]
SecondarySignPolicy = Literal["yield", "stop"]
PedestrianCrossingKind = Literal["zebra", "signalized", "uncontrolled"]


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
    role: ApproachRole | None = None
    priority_rank: int | None = None
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


class IntersectionApproachPriorityPatchRequest(BaseModel):
    """Patch role/rank for one approach."""

    model_config = ConfigDict(extra="forbid")

    role: ApproachRole | None = None
    priority_rank: int | None = Field(default=None, ge=0)


class PrioritySchemeItem(BaseModel):
    """Bulk priority item for one approach."""

    model_config = ConfigDict(extra="forbid")

    approach_id: str
    role: ApproachRole | None = None
    priority_rank: int | None = Field(default=None, ge=0)


class PrioritySchemePutRequest(BaseModel):
    """Bulk update priority scheme by approaches."""

    model_config = ConfigDict(extra="forbid")

    items: list[PrioritySchemeItem] = Field(min_length=1)
    reset_missing: bool = False


class PrioritySchemeSummary(BaseModel):
    """Derived priority summary."""

    model_config = ConfigDict(from_attributes=True)

    main_count: int
    secondary_count: int
    unassigned_count: int
    is_complete: bool
    has_conflicts: bool


class PrioritySchemeResponse(BaseModel):
    """Priority scheme DTO."""

    model_config = ConfigDict(from_attributes=True)

    intersection_id: str
    approaches: list[IntersectionApproachResponse]
    summary: PrioritySchemeSummary


class PrioritySchemeValidationResponse(BaseModel):
    """Priority scheme validation DTO."""

    model_config = ConfigDict(from_attributes=True)

    intersection_id: str
    is_valid: bool
    is_complete: bool
    missing_roles: list[str]
    warnings: list[str]
    errors: list[str]
    exportable_as_priority_controlled: bool


class SignGenerationRequest(BaseModel):
    """Generated sign policy for priority scheme."""

    model_config = ConfigDict(extra="forbid")

    secondary_sign_type: SecondarySignPolicy = "yield"


class TrafficSignResponse(BaseModel):
    """Traffic sign DTO."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    intersection_id: str | None = None
    approach_id: str | None = None
    node_id: str | None = None
    edge_id: str | None = None
    sign_type: TrafficSignType
    generated: bool
    metadata: dict[str, object] | None = None
    created_at: datetime
    updated_at: datetime


class SignGenerationResponse(BaseModel):
    """Generated sign upsert result."""

    model_config = ConfigDict(from_attributes=True)

    intersection_id: str
    secondary_sign_type: SecondarySignPolicy
    created_count: int
    updated_count: int
    deleted_count: int
    signs: list[TrafficSignResponse]
    diagnostics: list[str]


class IntersectionExportHintsResponse(BaseModel):
    """Derived export hints for intersection."""

    model_config = ConfigDict(from_attributes=True)

    intersection_id: str
    node_type: str | None = None
    priority_controlled: bool
    requires_stop_signs: bool
    requires_yield_signs: bool
    notes: list[str]


class PedestrianCrossingCreateRequest(BaseModel):
    """Create one pedestrian crossing on intersection side."""

    model_config = ConfigDict(extra="forbid")

    approach_id: str | None = None
    side_key: str = Field(min_length=1, max_length=255)
    is_enabled: bool = True
    name: str | None = Field(default=None, max_length=512)
    crossing_kind: PedestrianCrossingKind | None = None


class PedestrianCrossingPatchRequest(BaseModel):
    """Patch pedestrian crossing fields."""

    model_config = ConfigDict(extra="forbid")

    approach_id: str | None = None
    side_key: str | None = Field(default=None, min_length=1, max_length=255)
    is_enabled: bool | None = None
    name: str | None = Field(default=None, max_length=512)
    crossing_kind: PedestrianCrossingKind | None = None


class PedestrianCrossingResponse(BaseModel):
    """Pedestrian crossing DTO."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    intersection_id: str
    approach_id: str | None = None
    side_key: str
    is_enabled: bool
    name: str | None = None
    crossing_kind: PedestrianCrossingKind | None = None
    incoming_edge_id: str | None = None
    incoming_edge_code: str | None = None
    created_at: datetime
    updated_at: datetime


class PedestrianCrossingListResponse(BaseModel):
    """Crossing list for one intersection."""

    model_config = ConfigDict(from_attributes=True)

    intersection_id: str
    crossings: list[PedestrianCrossingResponse]


class PedestrianCrossingSideCandidateResponse(BaseModel):
    """Candidate side for crossing creation."""

    model_config = ConfigDict(from_attributes=True)

    side_key: str
    approach_id: str | None = None
    incoming_edge_id: str | None = None
    incoming_edge_code: str | None = None
    already_has_crossing: bool
    crossing_id: str | None = None
    crossing_is_enabled: bool | None = None


class PedestrianCrossingSidesResponse(BaseModel):
    """Candidate sides and diagnostics for intersection."""

    model_config = ConfigDict(from_attributes=True)

    intersection_id: str
    candidate_sides: list[PedestrianCrossingSideCandidateResponse]
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
    priority_scheme: PrioritySchemeResponse
    generated_signs: list[TrafficSignResponse]
    export_hints: IntersectionExportHintsResponse
    pedestrian_crossings: list[PedestrianCrossingResponse]
    pedestrian_crossing_sides: PedestrianCrossingSidesResponse
