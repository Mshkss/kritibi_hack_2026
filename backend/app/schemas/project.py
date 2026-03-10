"""Pydantic schemas for Project."""

from typing import Optional

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    code: str


class ProjectUpdate(BaseModel):
    code: Optional[str] = None


class ProjectRead(BaseModel):
    id: str
    code: str
