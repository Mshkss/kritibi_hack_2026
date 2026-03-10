"""Pydantic schemas for Intersection."""

from typing import Optional

from pydantic import BaseModel


class IntersectionCreate(BaseModel):
    code: str


class IntersectionUpdate(BaseModel):
    code: Optional[str] = None


class IntersectionRead(BaseModel):
    id: str
    code: str
