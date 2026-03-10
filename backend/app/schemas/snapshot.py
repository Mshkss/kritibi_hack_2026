"""Snapshot DTOs."""

from pydantic import BaseModel


class ProjectSnapshot(BaseModel):
    project_id: str
    nodes: list[dict] = []
    edges: list[dict] = []
