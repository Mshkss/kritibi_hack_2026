"""Pydantic schemas for Connection."""

from typing import Optional

from pydantic import BaseModel


class ConnectionCreate(BaseModel):
    code: str


class ConnectionUpdate(BaseModel):
    code: Optional[str] = None


class ConnectionRead(BaseModel):
    id: str
    code: str
