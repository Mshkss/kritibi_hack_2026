"""Pydantic schemas for Edge."""

from typing import Optional

from pydantic import BaseModel


class EdgeCreate(BaseModel):
    code: str


class EdgeUpdate(BaseModel):
    code: Optional[str] = None


class EdgeRead(BaseModel):
    id: str
    code: str
