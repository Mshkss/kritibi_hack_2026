"""Builder service for intersection approaches."""

from app.models.intersection import IntersectionModel
from app.repositories.edge import EdgeRepository
from app.repositories.intersection_approach import IntersectionApproachRepository
from app.services.errors import NotFoundError, ValidationError


class ApproachBuilderService:
    """Builds/synchronizes incoming approaches for intersections."""

    def __init__(
        self,
        edge_repository: EdgeRepository,
        approach_repository: IntersectionApproachRepository,
    ):
        self._edge_repository = edge_repository
        self._approach_repository = approach_repository

    def list_directional_edges(self, intersection: IntersectionModel) -> tuple[list, list]:
        incoming = self._edge_repository.list_incoming_for_node(intersection.project_id, intersection.node_id)
        outgoing = self._edge_repository.list_outgoing_for_node(intersection.project_id, intersection.node_id)
        return incoming, outgoing

    def sync(
        self,
        intersection: IntersectionModel,
        *,
        add_missing_only: bool = True,
        remove_stale: bool = False,
        commit: bool = True,
    ) -> dict[str, object]:
        incoming_edges = self._edge_repository.list_incoming_for_node(intersection.project_id, intersection.node_id)
        incoming_edges = sorted(incoming_edges, key=lambda edge: edge.code)

        existing = self._approach_repository.list_by_intersection(intersection.id)
        existing_by_edge = {approach.incoming_edge_id: approach for approach in existing}
        incoming_edge_ids = {edge.id for edge in incoming_edges}

        created_items: list[dict[str, object]] = []
        max_order = max(
            [approach.order_index for approach in existing if approach.order_index is not None],
            default=-1,
        )
        for edge in incoming_edges:
            if edge.id in existing_by_edge:
                continue
            max_order += 1
            created_items.append(
                {
                    "project_id": intersection.project_id,
                    "intersection_id": intersection.id,
                    "incoming_edge_id": edge.id,
                    "order_index": max_order,
                    "name": None,
                }
            )

        stale = [approach for approach in existing if approach.incoming_edge_id not in incoming_edge_ids]
        should_remove_stale = remove_stale or not add_missing_only

        try:
            created = self._approach_repository.bulk_create(created_items, commit=False) if created_items else []
            deleted_count = 0
            if should_remove_stale and stale:
                deleted_count = self._approach_repository.delete_many([item.id for item in stale], commit=False)

            if commit:
                self._approach_repository.commit()
            approaches = self._approach_repository.list_by_intersection(intersection.id)
        except Exception:
            self._approach_repository.rollback()
            raise

        diagnostics: list[str] = [
            f"incoming_edges={len(incoming_edges)}",
            f"created={len(created_items)}",
            f"stale_detected={len(stale)}",
            f"stale_removed={deleted_count if should_remove_stale else 0}",
        ]
        if stale and not should_remove_stale:
            diagnostics.append("stale approaches kept (remove_stale=false)")

        return {
            "intersection_id": intersection.id,
            "created_count": len(created_items),
            "deleted_count": deleted_count if should_remove_stale else 0,
            "stale_count": len(stale),
            "approaches": approaches,
            "diagnostics": diagnostics,
        }

    def validate_approach_incoming_edge(self, intersection: IntersectionModel, incoming_edge_id: str) -> None:
        edge = self._edge_repository.get_in_project(intersection.project_id, incoming_edge_id)
        if edge is None:
            raise NotFoundError(f"incoming_edge '{incoming_edge_id}' not found in project '{intersection.project_id}'")
        if edge.to_node_id != intersection.node_id:
            raise ValidationError(
                f"Edge '{incoming_edge_id}' is not incoming for node '{intersection.node_id}'"
            )
