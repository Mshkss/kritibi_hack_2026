"""Pydantic schemas for RoadType."""

from typing import Optional

from pydantic import BaseModel


class RoadTypeCreate(BaseModel):
    code: str


class RoadTypeUpdate(BaseModel):
    code: Optional[str] = None


class RoadTypeRead(BaseModel):
    id: str
    code: str
