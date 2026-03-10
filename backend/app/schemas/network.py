"""Project network DTO schemas."""

from pydantic import BaseModel, ConfigDict

from app.schemas.edge import EdgeRead
from app.schemas.node import NodeRead
from app.schemas.project import ProjectRead
from app.schemas.road_type import RoadTypeRead


class ProjectNetworkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    project: ProjectRead
    nodes: list[NodeRead]
    road_types: list[RoadTypeRead]
    edges: list[EdgeRead]
