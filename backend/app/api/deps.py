"""Shared API dependencies."""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.edge import EdgeRepository
from app.repositories.node import NodeRepository
from app.repositories.project import ProjectRepository
from app.repositories.road_type import RoadTypeRepository
from app.services.edge_service import EdgeService
from app.services.geometry_service import GeometryService
from app.services.graph_service import GraphService
from app.services.node_service import NodeService
from app.services.project_service import ProjectService
from app.services.road_type_service import RoadTypeService


def get_project_service(db: Session = Depends(get_db)) -> ProjectService:
    """Build ProjectService for request scope."""
    repository = ProjectRepository(db)
    return ProjectService(repository)


def get_geometry_service() -> GeometryService:
    return GeometryService()


def get_node_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
    geometry_service: GeometryService = Depends(get_geometry_service),
) -> NodeService:
    node_repository = NodeRepository(db)
    edge_repository = EdgeRepository(db)
    return NodeService(
        node_repository=node_repository,
        edge_repository=edge_repository,
        project_service=project_service,
        geometry_service=geometry_service,
    )


def get_road_type_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
) -> RoadTypeService:
    repository = RoadTypeRepository(db)
    return RoadTypeService(repository=repository, project_service=project_service)


def get_edge_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
    geometry_service: GeometryService = Depends(get_geometry_service),
) -> EdgeService:
    return EdgeService(
        edge_repository=EdgeRepository(db),
        node_repository=NodeRepository(db),
        road_type_repository=RoadTypeRepository(db),
        project_service=project_service,
        geometry_service=geometry_service,
    )


def get_graph_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
) -> GraphService:
    return GraphService(
        project_service=project_service,
        node_repository=NodeRepository(db),
        edge_repository=EdgeRepository(db),
        road_type_repository=RoadTypeRepository(db),
    )


__all__ = [
    "get_db",
    "get_edge_service",
    "get_geometry_service",
    "get_graph_service",
    "get_node_service",
    "get_project_service",
    "get_road_type_service",
]
