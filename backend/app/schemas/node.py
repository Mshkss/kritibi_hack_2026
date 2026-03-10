"""Pydantic schemas for Node."""

from typing import Optional

from pydantic import BaseModel


class NodeCreate(BaseModel):
    code: str


class NodeUpdate(BaseModel):
    code: Optional[str] = None


class NodeRead(BaseModel):
    id: str
    code: str
