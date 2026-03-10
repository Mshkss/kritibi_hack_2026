"""Read service for project graph snapshot."""

from app.repositories.edge import EdgeRepository
from app.repositories.node import NodeRepository
from app.repositories.road_type import RoadTypeRepository
from app.services.project_service import ProjectService


class GraphService:
    """Returns full network payload for project."""

    def __init__(
        self,
        project_service: ProjectService,
        node_repository: NodeRepository,
        edge_repository: EdgeRepository,
        road_type_repository: RoadTypeRepository,
    ):
        self._project_service = project_service
        self._node_repository = node_repository
        self._edge_repository = edge_repository
        self._road_type_repository = road_type_repository

    def get_project_network(self, project_id: str) -> dict[str, object]:
        project = self._project_service.get(project_id)
        nodes = self._node_repository.list_by_project(project_id)
        edges = self._edge_repository.list_by_project(project_id)
        road_types = self._road_type_repository.list_by_project(project_id)

        return {
            "project": project,
            "nodes": nodes,
            "road_types": road_types,
            "edges": edges,
        }
