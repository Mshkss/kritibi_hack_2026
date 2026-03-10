"""Pydantic schemas for Phase."""

from typing import Optional

from pydantic import BaseModel


class PhaseCreate(BaseModel):
    code: str


class PhaseUpdate(BaseModel):
    code: Optional[str] = None


class PhaseRead(BaseModel):
    id: str
    code: str
