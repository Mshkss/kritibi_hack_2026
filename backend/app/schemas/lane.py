"""Pydantic schemas for Lane."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LaneUpsert(BaseModel):
    """Lane payload used in edge create/update operations."""

    model_config = ConfigDict(extra="forbid")

    index: int = Field(ge=0)
    allow: str | None = Field(default=None, max_length=1024)
    disallow: str | None = Field(default=None, max_length=1024)
    speed: float | None = Field(default=None)
    width: float | None = Field(default=None)


class LaneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    edge_id: str
    index: int
    allow: str | None = None
    disallow: str | None = None
    speed: float | None = None
    width: float | None = None
    created_at: datetime
    updated_at: datetime
