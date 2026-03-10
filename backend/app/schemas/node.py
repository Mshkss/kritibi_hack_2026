"""Pydantic schemas for Node."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NodeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=128)
    x: float
    y: float
    type: str | None = Field(default=None, max_length=128)


class NodeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str | None = Field(default=None, min_length=1, max_length=128)
    x: float | None = None
    y: float | None = None
    type: str | None = Field(default=None, max_length=128)


class NodeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    code: str
    x: float
    y: float
    type: str | None = None
    created_at: datetime
    updated_at: datetime
