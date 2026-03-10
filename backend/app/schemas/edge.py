"""Pydantic schemas for Edge."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.lane import LaneRead, LaneUpsert


class PointDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: float
    y: float


class EdgeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=128)
    from_node_id: str
    to_node_id: str
    road_type_id: str | None = None
    name: str | None = Field(default=None, max_length=512)
    speed: float | None = None
    priority: int | None = None
    length: float | None = None
    width: float | None = None
    sidewalk_width: float | None = Field(default=None, ge=0)
    shape: list[PointDTO] = Field(min_length=2)
    lanes: list[LaneUpsert] | None = None


class EdgeBidirectionalCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    forward_code: str = Field(min_length=1, max_length=128)
    reverse_code: str = Field(min_length=1, max_length=128)
    from_node_id: str
    to_node_id: str
    road_type_id: str | None = None
    forward_name: str | None = Field(default=None, max_length=512)
    reverse_name: str | None = Field(default=None, max_length=512)
    speed: float | None = None
    priority: int | None = None
    length: float | None = None
    width: float | None = None
    sidewalk_width: float | None = Field(default=None, ge=0)
    shape: list[PointDTO] = Field(min_length=2)
    lanes: list[LaneUpsert] | None = None


class EdgeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str | None = Field(default=None, min_length=1, max_length=128)
    from_node_id: str | None = None
    to_node_id: str | None = None
    road_type_id: str | None = None
    name: str | None = Field(default=None, max_length=512)
    speed: float | None = None
    priority: int | None = None
    length: float | None = None
    width: float | None = None
    sidewalk_width: float | None = Field(default=None, ge=0)
    shape: list[PointDTO] | None = None


class EdgeShapePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shape: list[PointDTO] = Field(min_length=2)


class EdgeRoadTypePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    road_type_id: str | None


class EdgeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    code: str
    from_node_id: str
    to_node_id: str
    road_type_id: str | None = None
    name: str | None = None
    speed: float | None = None
    priority: int | None = None
    length: float | None = None
    width: float | None = None
    sidewalk_width: float | None = None
    shape: list[PointDTO]
    lanes: list[LaneRead]
    num_lanes: int
    created_at: datetime
    updated_at: datetime
