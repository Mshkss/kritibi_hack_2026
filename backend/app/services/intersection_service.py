"""Application service for intersection editor layer."""

from sqlalchemy.exc import IntegrityError

from app.repositories.edge import EdgeRepository
from app.repositories.intersection import IntersectionRepository
from app.repositories.intersection_approach import IntersectionApproachRepository
from app.repositories.movement import MovementRepository
from app.repositories.node import NodeRepository
from app.schemas.intersection import (
    ApproachesSyncRequest,
    IntersectionCreateRequest,
    IntersectionApproachPriorityPatchRequest,
    IntersectionPatchRequest,
    MovementPatchRequest,
    MovementsSyncRequest,
    PrioritySchemePutRequest,
    SignGenerationRequest,
)
from app.services.approach_builder_service import ApproachBuilderService
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.movement_builder_service import MovementBuilderService
from app.services.priority_scheme_service import PrioritySchemeService
from app.services.project_service import ProjectService
from app.services.sign_generation_service import SignGenerationService


class IntersectionService:
    """Intersection editor orchestration service."""

    def __init__(
        self,
        intersection_repository: IntersectionRepository,
        approach_repository: IntersectionApproachRepository,
        movement_repository: MovementRepository,
        node_repository: NodeRepository,
        edge_repository: EdgeRepository,
        project_service: ProjectService,
        approach_builder_service: ApproachBuilderService,
        movement_builder_service: MovementBuilderService,
        priority_scheme_service: PrioritySchemeService,
        sign_generation_service: SignGenerationService,
    ):
        self._intersection_repository = intersection_repository
        self._approach_repository = approach_repository
        self._movement_repository = movement_repository
        self._node_repository = node_repository
        self._edge_repository = edge_repository
        self._project_service = project_service
        self._approach_builder = approach_builder_service
        self._movement_builder = movement_builder_service
        self._priority_scheme_service = priority_scheme_service
        self._sign_generation_service = sign_generation_service

    def create(self, project_id: str, payload: IntersectionCreateRequest):
        self._project_service.get(project_id)
        node = self._node_repository.get_in_project(project_id, payload.node_id)
        if node is None:
            raise NotFoundError(f"Node '{payload.node_id}' not found in project '{project_id}'")

        existing = self._intersection_repository.get_by_node(project_id, node.id)
        if existing is not None:
            raise ConflictError(f"Intersection already exists for node '{node.id}'")

        incoming_edges = self._edge_repository.list_incoming_for_node(project_id, node.id)
        outgoing_edges = self._edge_repository.list_outgoing_for_node(project_id, node.id)
        if len(incoming_edges) == 0 or len(outgoing_edges) == 0:
            raise ValidationError(
                "Intersection node must have at least one incoming and one outgoing edge"
            )

        try:
            intersection = self._intersection_repository.create(
                project_id=project_id,
                node_id=node.id,
                kind=payload.kind,
                name=payload.name,
                commit=False,
            )
            if payload.auto_sync:
                self._approach_builder.sync(
                    intersection,
                    add_missing_only=True,
                    remove_stale=False,
                    commit=False,
                )
                self._movement_builder.sync(
                    intersection,
                    add_missing_only=True,
                    remove_stale=False,
                    default_is_enabled=True,
                    commit=False,
                )
            self._intersection_repository.commit()
            return self.get(project_id, intersection.id)
        except IntegrityError as exc:
            self._intersection_repository.rollback()
            raise ConflictError("Intersection create violates constraints") from exc
        except Exception:
            self._intersection_repository.rollback()
            raise

    def get(self, project_id: str, intersection_id: str):
        self._project_service.get(project_id)
        intersection = self._intersection_repository.get_in_project(project_id, intersection_id)
        if intersection is None:
            raise NotFoundError(f"Intersection '{intersection_id}' not found in project '{project_id}'")
        return intersection

    def get_by_node(self, project_id: str, node_id: str):
        self._project_service.get(project_id)
        node = self._node_repository.get_in_project(project_id, node_id)
        if node is None:
            raise NotFoundError(f"Node '{node_id}' not found in project '{project_id}'")
        intersection = self._intersection_repository.get_by_node(project_id, node_id)
        if intersection is None:
            raise NotFoundError(f"Intersection for node '{node_id}' not found in project '{project_id}'")
        return intersection

    def patch(self, project_id: str, intersection_id: str, payload: IntersectionPatchRequest):
        if not payload.model_fields_set:
            raise ValidationError("PATCH payload must include at least one field")

        intersection = self.get(project_id, intersection_id)
        update_data = payload.model_dump(exclude_unset=True)

        try:
            return self._intersection_repository.update(intersection, **update_data)
        except IntegrityError as exc:
            self._intersection_repository.rollback()
            raise ConflictError("Intersection update violates constraints") from exc

    def list_approaches(self, project_id: str, intersection_id: str):
        intersection = self.get(project_id, intersection_id)
        return self._approach_repository.list_by_intersection(intersection.id)

    def sync_approaches(self, project_id: str, intersection_id: str, payload: ApproachesSyncRequest):
        intersection = self.get(project_id, intersection_id)
        return self._approach_builder.sync(
            intersection,
            add_missing_only=payload.add_missing_only,
            remove_stale=payload.remove_stale,
        )

    def list_movements(self, project_id: str, intersection_id: str):
        intersection = self.get(project_id, intersection_id)
        return self._movement_builder.list_by_intersection(intersection.id)

    def sync_movements(self, project_id: str, intersection_id: str, payload: MovementsSyncRequest):
        intersection = self.get(project_id, intersection_id)
        # Ensure incoming edges have approaches before movement sync.
        self._approach_builder.sync(
            intersection,
            add_missing_only=True,
            remove_stale=False,
        )
        return self._movement_builder.sync(
            intersection,
            add_missing_only=payload.add_missing_only,
            remove_stale=payload.remove_stale,
            default_is_enabled=payload.default_is_enabled,
        )

    def patch_movement(
        self,
        project_id: str,
        intersection_id: str,
        movement_id: str,
        payload: MovementPatchRequest,
    ):
        intersection = self.get(project_id, intersection_id)
        return self._movement_builder.patch_movement(intersection.id, movement_id, payload)

    def validation(self, project_id: str, intersection_id: str) -> dict[str, object]:
        intersection = self.get(project_id, intersection_id)
        return self._movement_builder.validate_intersection(intersection)

    def patch_approach_priority(
        self,
        project_id: str,
        intersection_id: str,
        approach_id: str,
        payload: IntersectionApproachPriorityPatchRequest,
    ):
        return self._priority_scheme_service.patch_approach(
            project_id=project_id,
            intersection_id=intersection_id,
            approach_id=approach_id,
            payload=payload,
        )

    def put_priority_scheme(
        self,
        project_id: str,
        intersection_id: str,
        payload: PrioritySchemePutRequest,
    ) -> dict[str, object]:
        return self._priority_scheme_service.put_scheme(project_id, intersection_id, payload)

    def get_priority_scheme(self, project_id: str, intersection_id: str) -> dict[str, object]:
        return self._priority_scheme_service.get_scheme(project_id, intersection_id)

    def priority_validation(self, project_id: str, intersection_id: str) -> dict[str, object]:
        return self._priority_scheme_service.validate(project_id, intersection_id)

    def generate_signs(
        self,
        project_id: str,
        intersection_id: str,
        payload: SignGenerationRequest,
    ) -> dict[str, object]:
        return self._sign_generation_service.generate(project_id, intersection_id, payload)

    def list_signs(self, project_id: str, intersection_id: str):
        return self._sign_generation_service.list_signs(project_id, intersection_id)

    def export_hints(self, project_id: str, intersection_id: str) -> dict[str, object]:
        return self._sign_generation_service.export_hints(project_id, intersection_id)

    def editor_card(self, project_id: str, intersection_id: str) -> dict[str, object]:
        intersection = self.get(project_id, intersection_id)
        node = intersection.node
        incoming_edges, outgoing_edges = self._approach_builder.list_directional_edges(intersection)
        approaches = self._approach_repository.list_by_intersection(intersection.id)
        movements = self._movement_builder.list_by_intersection(intersection.id)
        diagnostics = self._movement_builder.validate_intersection(intersection)
        priority_scheme = self._priority_scheme_service.get_scheme(project_id, intersection.id)
        generated_signs = self._sign_generation_service.list_signs(project_id, intersection.id)
        export_hints = self._sign_generation_service.export_hints(project_id, intersection.id)

        return {
            "intersection": intersection,
            "node": node,
            "incoming_edges": incoming_edges,
            "outgoing_edges": outgoing_edges,
            "approaches": approaches,
            "movements": movements,
            "diagnostics": diagnostics,
            "priority_scheme": priority_scheme,
            "generated_signs": generated_signs,
            "export_hints": export_hints,
        }
