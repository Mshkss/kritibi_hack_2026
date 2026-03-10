"""Pydantic schemas for Lane."""

from typing import Optional

from pydantic import BaseModel


class LaneCreate(BaseModel):
    code: str


class LaneUpdate(BaseModel):
    code: Optional[str] = None


class LaneRead(BaseModel):
    id: str
    code: str
