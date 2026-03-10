"""Business operations for network nodes."""

from sqlalchemy.exc import IntegrityError

from app.repositories.edge import EdgeRepository
from app.repositories.node import NodeRepository
from app.schemas.node import NodeCreate, NodeUpdate
from app.services.errors import ConflictError, DependencyError, NotFoundError, ValidationError
from app.services.geometry_service import GeometryService, GeometryValidationError
from app.services.project_service import ProjectService


class NodeService:
    """Application service for node operations."""

    def __init__(
        self,
        node_repository: NodeRepository,
        edge_repository: EdgeRepository,
        project_service: ProjectService,
        geometry_service: GeometryService,
    ):
        self._node_repository = node_repository
        self._edge_repository = edge_repository
        self._project_service = project_service
        self._geometry_service = geometry_service

    def create(self, project_id: str, payload: NodeCreate):
        self._project_service.get(project_id)

        try:
            point = self._geometry_service.validate_point(payload.x, payload.y)
        except GeometryValidationError as exc:
            raise ValidationError(str(exc)) from exc

        try:
            return self._node_repository.create(
                project_id=project_id,
                code=payload.code,
                x=point["x"],
                y=point["y"],
                node_type=payload.type,
            )
        except IntegrityError as exc:
            self._node_repository.rollback()
            raise ConflictError(f"Node with code '{payload.code}' already exists in project") from exc

    def list_by_project(self, project_id: str):
        self._project_service.get(project_id)
        return self._node_repository.list_by_project(project_id)

    def update(self, project_id: str, node_id: str, payload: NodeUpdate):
        if not payload.model_fields_set:
            raise ValidationError("PATCH payload must include at least one field")

        node = self._node_repository.get_in_project(project_id, node_id)
        if node is None:
            raise NotFoundError(f"Node '{node_id}' not found in project '{project_id}'")

        update_data = payload.model_dump(exclude_unset=True)
        if "code" in update_data and update_data["code"] is None:
            raise ValidationError("code cannot be null")

        if "x" in update_data:
            update_data["x"] = self._geometry_service.validate_coordinate(update_data["x"], field_name="x")
        if "y" in update_data:
            update_data["y"] = self._geometry_service.validate_coordinate(update_data["y"], field_name="y")

        changed_xy = "x" in update_data or "y" in update_data

        try:
            self._node_repository.update(node, commit=False, **update_data)

            if changed_xy:
                connected_edges = self._edge_repository.list_connected_to_node(project_id, node_id)
                for edge in connected_edges:
                    from_node = edge.from_node
                    to_node = edge.to_node
                    normalized_shape, computed_length = self._geometry_service.sync_shape_endpoints(
                        edge.shape,
                        from_x=from_node.x,
                        from_y=from_node.y,
                        to_x=to_node.x,
                        to_y=to_node.y,
                    )
                    self._edge_repository.update(
                        edge,
                        commit=False,
                        shape=normalized_shape,
                        length=computed_length,
                    )

            self._node_repository.commit()
            self._node_repository.session.refresh(node)
            return node
        except GeometryValidationError as exc:
            self._node_repository.rollback()
            raise ValidationError(str(exc)) from exc
        except IntegrityError as exc:
            self._node_repository.rollback()
            raise ConflictError("Node update violates unique constraints") from exc

    def delete(self, project_id: str, node_id: str) -> None:
        node = self._node_repository.get_in_project(project_id, node_id)
        if node is None:
            raise NotFoundError(f"Node '{node_id}' not found in project '{project_id}'")

        if self._edge_repository.exists_for_node(project_id, node_id):
            raise DependencyError("Node cannot be deleted while it is referenced by edges")

        self._node_repository.delete(node)
