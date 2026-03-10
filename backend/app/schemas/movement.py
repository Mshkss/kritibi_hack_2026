"""Pydantic schemas for Movement."""

from typing import Optional

from pydantic import BaseModel


class MovementCreate(BaseModel):
    code: str


class MovementUpdate(BaseModel):
    code: Optional[str] = None


class MovementRead(BaseModel):
    id: str
    code: str
