"""Service for pedestrian crossing editor layer."""

from sqlalchemy.exc import IntegrityError

from app.models.intersection import IntersectionModel
from app.repositories.intersection import IntersectionRepository
from app.repositories.intersection_approach import IntersectionApproachRepository
from app.repositories.pedestrian_crossing import PedestrianCrossingRepository
from app.schemas.intersection import PedestrianCrossingCreateRequest, PedestrianCrossingPatchRequest
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.project_service import ProjectService


class PedestrianCrossingService:
    """Creates/updates/list crossings attached to intersection sides."""

    def __init__(
        self,
        intersection_repository: IntersectionRepository,
        approach_repository: IntersectionApproachRepository,
        pedestrian_crossing_repository: PedestrianCrossingRepository,
        project_service: ProjectService,
    ):
        self._intersection_repository = intersection_repository
        self._approach_repository = approach_repository
        self._pedestrian_crossing_repository = pedestrian_crossing_repository
        self._project_service = project_service

    def create(
        self,
        project_id: str,
        intersection_id: str,
        payload: PedestrianCrossingCreateRequest,
    ):
        intersection = self._get_intersection(project_id, intersection_id)
        update_data = self._resolve_side_binding(
            intersection=intersection,
            side_key=payload.side_key,
            approach_id=payload.approach_id,
            existing_crossing_id=None,
        )

        crossing_kind = payload.crossing_kind
        if crossing_kind == "":
            crossing_kind = None

        try:
            return self._pedestrian_crossing_repository.create(
                project_id=project_id,
                intersection_id=intersection.id,
                approach_id=update_data["approach_id"],
                side_key=update_data["side_key"],
                is_enabled=payload.is_enabled,
                name=payload.name,
                crossing_kind=crossing_kind,
            )
        except IntegrityError as exc:
            self._pedestrian_crossing_repository.rollback()
            raise ConflictError("Pedestrian crossing create violates constraints") from exc

    def list_by_intersection(self, project_id: str, intersection_id: str):
        intersection = self._get_intersection(project_id, intersection_id)
        return self._pedestrian_crossing_repository.list_by_intersection(intersection.id)

    def get(self, project_id: str, intersection_id: str, crossing_id: str):
        intersection = self._get_intersection(project_id, intersection_id)
        crossing = self._pedestrian_crossing_repository.get_in_intersection(intersection.id, crossing_id)
        if crossing is None:
            raise NotFoundError(f"PedestrianCrossing '{crossing_id}' not found in intersection '{intersection_id}'")
        return crossing

    def patch(
        self,
        project_id: str,
        intersection_id: str,
        crossing_id: str,
        payload: PedestrianCrossingPatchRequest,
    ):
        if not payload.model_fields_set:
            raise ValidationError("PATCH payload must include at least one field")

        crossing = self.get(project_id, intersection_id, crossing_id)
        update_data = payload.model_dump(exclude_unset=True)

        if "crossing_kind" in update_data and update_data["crossing_kind"] == "":
            update_data["crossing_kind"] = None

        side_key = update_data["side_key"] if "side_key" in update_data else crossing.side_key
        approach_id = update_data["approach_id"] if "approach_id" in update_data else crossing.approach_id

        side_binding = self._resolve_side_binding(
            intersection=crossing.intersection,
            side_key=side_key,
            approach_id=approach_id,
            existing_crossing_id=crossing.id,
        )
        update_data["side_key"] = side_binding["side_key"]
        update_data["approach_id"] = side_binding["approach_id"]

        try:
            return self._pedestrian_crossing_repository.update(crossing, **update_data)
        except IntegrityError as exc:
            self._pedestrian_crossing_repository.rollback()
            raise ConflictError("Pedestrian crossing update violates constraints") from exc

    def delete(self, project_id: str, intersection_id: str, crossing_id: str) -> None:
        crossing = self.get(project_id, intersection_id, crossing_id)
        self._pedestrian_crossing_repository.delete(crossing)

    def candidate_sides(self, project_id: str, intersection_id: str) -> dict[str, object]:
        intersection = self._get_intersection(project_id, intersection_id)
        approaches = self._approach_repository.list_by_intersection(intersection.id)
        crossings = self._pedestrian_crossing_repository.list_by_intersection(intersection.id)
        crossing_by_side = {item.side_key: item for item in crossings}

        candidate_sides: list[dict[str, object]] = []
        for approach in approaches:
            side_key = self._side_key_for_approach(approach.id)
            crossing = crossing_by_side.get(side_key)
            candidate_sides.append(
                {
                    "side_key": side_key,
                    "approach_id": approach.id,
                    "incoming_edge_id": approach.incoming_edge_id,
                    "incoming_edge_code": approach.incoming_edge.code if approach.incoming_edge else None,
                    "already_has_crossing": crossing is not None,
                    "crossing_id": crossing.id if crossing is not None else None,
                    "crossing_is_enabled": crossing.is_enabled if crossing is not None else None,
                }
            )

        warnings: list[str] = []
        errors: list[str] = []
        if not approaches:
            warnings.append("Intersection has no approaches; candidate side list is empty")

        return {
            "intersection_id": intersection.id,
            "candidate_sides": candidate_sides,
            "warnings": warnings,
            "errors": errors,
        }

    def _resolve_side_binding(
        self,
        *,
        intersection: IntersectionModel,
        side_key: str,
        approach_id: str | None,
        existing_crossing_id: str | None,
    ) -> dict[str, str | None]:
        normalized_side_key = side_key.strip()
        if not normalized_side_key:
            raise ValidationError("side_key must not be empty")

        approaches = self._approach_repository.list_by_intersection(intersection.id)
        approach_by_id = {item.id: item for item in approaches}
        candidate_side_keys = {self._side_key_for_approach(item.id): item.id for item in approaches}

        resolved_approach_id = approach_id
        if resolved_approach_id is not None:
            approach = approach_by_id.get(resolved_approach_id)
            if approach is None:
                raise ValidationError(
                    f"Approach '{resolved_approach_id}' is not part of intersection '{intersection.id}'"
                )
            expected_side_key = self._side_key_for_approach(approach.id)
            if normalized_side_key != expected_side_key:
                raise ValidationError(
                    f"side_key '{normalized_side_key}' must match approach side '{expected_side_key}'"
                )

        if approaches:
            if normalized_side_key not in candidate_side_keys:
                raise ValidationError(
                    f"side_key '{normalized_side_key}' is invalid for intersection '{intersection.id}'"
                )
            if resolved_approach_id is None:
                resolved_approach_id = candidate_side_keys[normalized_side_key]
        elif resolved_approach_id is not None:
            raise ValidationError("Cannot bind approach_id: intersection has no approaches")

        if self._pedestrian_crossing_repository.exists_for_side(
            intersection.id,
            normalized_side_key,
            exclude_id=existing_crossing_id,
        ):
            raise ConflictError(
                f"PedestrianCrossing for side '{normalized_side_key}' already exists in intersection '{intersection.id}'"
            )

        return {
            "side_key": normalized_side_key,
            "approach_id": resolved_approach_id,
        }

    def _get_intersection(self, project_id: str, intersection_id: str) -> IntersectionModel:
        self._project_service.get(project_id)
        intersection = self._intersection_repository.get_in_project(project_id, intersection_id)
        if intersection is None:
            raise NotFoundError(f"Intersection '{intersection_id}' not found in project '{project_id}'")
        return intersection

    @staticmethod
    def _side_key_for_approach(approach_id: str) -> str:
        return f"approach:{approach_id}"
