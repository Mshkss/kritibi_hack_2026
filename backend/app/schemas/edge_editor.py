"""DTOs for road segment editor API."""

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.edge import EdgeRead, PointDTO
from app.schemas.lane import LaneUpsert
from app.schemas.road_type import RoadTypeRead


class EdgeEditorResponse(BaseModel):
    """Editor card response for one edge."""

    model_config = ConfigDict(from_attributes=True)

    edge: EdgeRead
    road_type: RoadTypeRead | None = None


class EdgePatchRequest(BaseModel):
    """Editable edge properties in road segment editor."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=512)
    speed: float | None = None
    priority: int | None = None
    length: float | None = None
    width: float | None = None
    sidewalk_width: float | None = Field(default=None, ge=0)
    shape: list[PointDTO] | None = None
    road_type_id: str | None = None


class EdgeShapePatchRequest(BaseModel):
    """Shape-only update payload."""

    model_config = ConfigDict(extra="forbid")

    shape: list[PointDTO] = Field(min_length=2)


class LanePatchRequest(BaseModel):
    """Partial lane update payload."""

    model_config = ConfigDict(extra="forbid")

    index: int | None = Field(default=None, ge=0)
    allow: str | None = Field(default=None, max_length=1024)
    disallow: str | None = Field(default=None, max_length=1024)
    speed: float | None = None
    width: float | None = None


class LaneReplaceListRequest(BaseModel):
    """Full lane list replacement payload."""

    model_config = ConfigDict(extra="forbid")

    lanes: list[LaneUpsert] = Field(min_length=1)


class ApplyRoadTypeRequest(BaseModel):
    """Apply road type defaults to edge with optional overrides."""

    model_config = ConfigDict(extra="forbid")

    road_type_id: str
    speed: float | None = None
    priority: int | None = None
    width: float | None = None
    sidewalk_width: float | None = Field(default=None, ge=0)
    lane_speed: float | None = None
    lane_width: float | None = None
    apply_to_lanes: bool = True
