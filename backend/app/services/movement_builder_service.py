"""Builder service for intersection movements over connections."""

from sqlalchemy.exc import IntegrityError

from app.models.intersection import IntersectionModel
from app.repositories.connection import ConnectionRepository
from app.repositories.intersection_approach import IntersectionApproachRepository
from app.repositories.movement import MovementRepository
from app.schemas.intersection import MovementPatchRequest
from app.services.errors import ConflictError, NotFoundError, ValidationError


class MovementBuilderService:
    """Builds/synchronizes movements from connection layer."""

    def __init__(
        self,
        movement_repository: MovementRepository,
        approach_repository: IntersectionApproachRepository,
        connection_repository: ConnectionRepository,
    ):
        self._movement_repository = movement_repository
        self._approach_repository = approach_repository
        self._connection_repository = connection_repository

    def list_by_intersection(self, intersection_id: str):
        return self._movement_repository.list_by_intersection(intersection_id)

    def sync(
        self,
        intersection: IntersectionModel,
        *,
        add_missing_only: bool = True,
        remove_stale: bool = False,
        default_is_enabled: bool = True,
        commit: bool = True,
    ) -> dict[str, object]:
        approaches = self._approach_repository.list_by_intersection(intersection.id)
        approach_by_incoming_edge = {approach.incoming_edge_id: approach for approach in approaches}

        active_connections = self._connection_repository.list_by_node(intersection.project_id, intersection.node_id)
        active_connection_ids = {connection.id for connection in active_connections}

        existing_movements = self._movement_repository.list_by_intersection(intersection.id)
        movement_by_connection = {movement.connection_id: movement for movement in existing_movements}

        create_items: list[dict[str, object]] = []
        updated_count = 0
        skipped_without_approach = 0

        try:
            for connection in active_connections:
                approach = approach_by_incoming_edge.get(connection.from_edge_id)
                if approach is None:
                    skipped_without_approach += 1
                    continue

                existing = movement_by_connection.get(connection.id)
                if existing is None:
                    create_items.append(
                        {
                            "project_id": intersection.project_id,
                            "intersection_id": intersection.id,
                            "approach_id": approach.id,
                            "connection_id": connection.id,
                            "from_edge_id": connection.from_edge_id,
                            "to_edge_id": connection.to_edge_id,
                            "from_lane_index": connection.from_lane_index,
                            "to_lane_index": connection.to_lane_index,
                            "is_enabled": default_is_enabled,
                            "movement_kind": None,
                        }
                    )
                    continue

                update_payload: dict[str, object] = {}
                if existing.approach_id != approach.id:
                    update_payload["approach_id"] = approach.id
                if existing.from_edge_id != connection.from_edge_id:
                    update_payload["from_edge_id"] = connection.from_edge_id
                if existing.to_edge_id != connection.to_edge_id:
                    update_payload["to_edge_id"] = connection.to_edge_id
                if existing.from_lane_index != connection.from_lane_index:
                    update_payload["from_lane_index"] = connection.from_lane_index
                if existing.to_lane_index != connection.to_lane_index:
                    update_payload["to_lane_index"] = connection.to_lane_index

                if update_payload:
                    self._movement_repository.update(existing, commit=False, **update_payload)
                    updated_count += 1

            stale = [movement for movement in existing_movements if movement.connection_id not in active_connection_ids]
            should_remove_stale = remove_stale or not add_missing_only
            deleted_count = 0
            if should_remove_stale and stale:
                deleted_count = self._movement_repository.delete_many([item.id for item in stale], commit=False)

            created = self._movement_repository.bulk_create(create_items, commit=False) if create_items else []
            if commit:
                self._movement_repository.commit()
        except IntegrityError as exc:
            self._movement_repository.rollback()
            raise ConflictError("Movement sync violates constraints") from exc
        except Exception:
            self._movement_repository.rollback()
            raise

        movements = self._movement_repository.list_by_intersection(intersection.id)
        diagnostics = [
            f"connections={len(active_connections)}",
            f"movements_existing={len(existing_movements)}",
            f"created={len(created)}",
            f"updated={updated_count}",
            f"stale_detected={len(stale)}",
            f"stale_removed={deleted_count if should_remove_stale else 0}",
            f"skipped_without_approach={skipped_without_approach}",
        ]
        if stale and not should_remove_stale:
            diagnostics.append("stale movements kept (remove_stale=false)")

        return {
            "intersection_id": intersection.id,
            "created_count": len(created),
            "updated_count": updated_count,
            "deleted_count": deleted_count if should_remove_stale else 0,
            "stale_count": len(stale),
            "movements": movements,
            "diagnostics": diagnostics,
        }

    def patch_movement(self, intersection_id: str, movement_id: str, payload: MovementPatchRequest):
        if not payload.model_fields_set:
            raise ValidationError("PATCH payload must include at least one field")

        movement = self._movement_repository.get_in_intersection(intersection_id, movement_id)
        if movement is None:
            raise NotFoundError(f"Movement '{movement_id}' not found in intersection '{intersection_id}'")

        update_data = payload.model_dump(exclude_unset=True)
        if "movement_kind" in update_data and update_data["movement_kind"] == "":
            update_data["movement_kind"] = None

        try:
            return self._movement_repository.update(movement, **update_data)
        except IntegrityError as exc:
            self._movement_repository.rollback()
            raise ConflictError("Movement update violates constraints") from exc

    def validate_intersection(self, intersection: IntersectionModel) -> dict[str, object]:
        approaches = self._approach_repository.list_by_intersection(intersection.id)
        movements = self._movement_repository.list_by_intersection(intersection.id)
        active_connections = self._connection_repository.list_by_node(intersection.project_id, intersection.node_id)

        active_connection_ids = {connection.id for connection in active_connections}
        approach_ids = {approach.id for approach in approaches}
        approach_by_id = {approach.id: approach for approach in approaches}

        missing_movements: list[str] = []
        for connection in active_connections:
            movement = next((item for item in movements if item.connection_id == connection.id), None)
            if movement is None:
                missing_movements.append(connection.id)

        stale_movements: list[str] = []
        for movement in movements:
            if movement.connection_id not in active_connection_ids:
                stale_movements.append(movement.id)
                continue
            if movement.approach_id not in approach_ids:
                stale_movements.append(movement.id)
                continue
            approach = approach_by_id[movement.approach_id]
            if approach.incoming_edge_id != movement.from_edge_id:
                stale_movements.append(movement.id)

        stale_set = set(stale_movements)
        empty_approaches: list[str] = []
        for approach in approaches:
            has_enabled = any(
                movement.approach_id == approach.id and movement.is_enabled and movement.id not in stale_set
                for movement in movements
            )
            if not has_enabled:
                empty_approaches.append(approach.id)

        warnings: list[str] = []
        errors: list[str] = []
        if empty_approaches:
            errors.append("Some approaches have no enabled movements")
        if missing_movements:
            errors.append("Some node connections are not wrapped into movements")
        if stale_movements:
            errors.append("Some movements are stale relative to active connections/approaches")

        if not approaches:
            warnings.append("Intersection has no approaches")
        if not movements:
            warnings.append("Intersection has no movements")

        return {
            "intersection_id": intersection.id,
            "is_valid": len(errors) == 0,
            "empty_approaches": empty_approaches,
            "missing_movements": missing_movements,
            "stale_movements": stale_movements,
            "warnings": warnings,
            "errors": errors,
        }
