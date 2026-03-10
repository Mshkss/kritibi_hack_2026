"""Pydantic schemas for RoadType."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RoadTypeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=128)
    name: str | None = Field(default=None, max_length=512)
    num_lanes: int | None = Field(default=None, gt=0)
    speed: float | None = None
    priority: int | None = None
    width: float | None = None
    sidewalk_width: float | None = Field(default=None, ge=0)


class RoadTypeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str | None = Field(default=None, min_length=1, max_length=128)
    name: str | None = Field(default=None, max_length=512)
    num_lanes: int | None = Field(default=None, gt=0)
    speed: float | None = None
    priority: int | None = None
    width: float | None = None
    sidewalk_width: float | None = Field(default=None, ge=0)


class RoadTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    code: str
    name: str | None = None
    num_lanes: int | None = None
    speed: float | None = None
    priority: int | None = None
    width: float | None = None
    sidewalk_width: float | None = None
    created_at: datetime
    updated_at: datetime
