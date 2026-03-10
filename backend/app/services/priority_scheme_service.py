"""Service for intersection approach priority scheme."""

from collections import defaultdict

from sqlalchemy.exc import IntegrityError

from app.models.intersection import IntersectionModel
from app.models.intersection_approach import IntersectionApproachModel
from app.repositories.intersection import IntersectionRepository
from app.repositories.intersection_approach import IntersectionApproachRepository
from app.schemas.intersection import (
    IntersectionApproachPriorityPatchRequest,
    PrioritySchemePutRequest,
)
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.project_service import ProjectService


class PrioritySchemeService:
    """Manages and validates priority roles on intersection approaches."""

    def __init__(
        self,
        intersection_repository: IntersectionRepository,
        approach_repository: IntersectionApproachRepository,
        project_service: ProjectService,
    ):
        self._intersection_repository = intersection_repository
        self._approach_repository = approach_repository
        self._project_service = project_service

    def get_scheme(self, project_id: str, intersection_id: str) -> dict[str, object]:
        intersection = self._get_intersection(project_id, intersection_id)
        approaches = self._approach_repository.list_by_intersection(intersection.id)
        summary, _, _ = self._build_summary(approaches)
        return {
            "intersection_id": intersection.id,
            "approaches": approaches,
            "summary": summary,
        }

    def patch_approach(
        self,
        project_id: str,
        intersection_id: str,
        approach_id: str,
        payload: IntersectionApproachPriorityPatchRequest,
    ) -> IntersectionApproachModel:
        if not payload.model_fields_set:
            raise ValidationError("PATCH payload must include at least one field")

        intersection = self._get_intersection(project_id, intersection_id)
        approach = self._approach_repository.get_in_intersection(intersection.id, approach_id)
        if approach is None:
            raise NotFoundError(f"Approach '{approach_id}' not found in intersection '{intersection_id}'")

        update_data = payload.model_dump(exclude_unset=True)
        try:
            return self._approach_repository.update(approach, **update_data)
        except IntegrityError as exc:
            self._approach_repository.rollback()
            raise ConflictError("Approach priority update violates constraints") from exc

    def put_scheme(
        self,
        project_id: str,
        intersection_id: str,
        payload: PrioritySchemePutRequest,
    ) -> dict[str, object]:
        intersection = self._get_intersection(project_id, intersection_id)
        approaches = self._approach_repository.list_by_intersection(intersection.id)
        approach_by_id = {item.id: item for item in approaches}

        duplicated_ids = self._find_duplicates([item.approach_id for item in payload.items])
        if duplicated_ids:
            raise ValidationError(f"Duplicate approach_id values in payload: {', '.join(duplicated_ids)}")

        update_items: list[dict[str, object]] = []
        touched_ids: set[str] = set()
        for item in payload.items:
            if item.approach_id not in approach_by_id:
                raise NotFoundError(
                    f"Approach '{item.approach_id}' is not part of intersection '{intersection_id}'"
                )
            update_items.append(
                {
                    "approach_id": item.approach_id,
                    "role": item.role,
                    "priority_rank": item.priority_rank,
                }
            )
            touched_ids.add(item.approach_id)

        try:
            self._approach_repository.bulk_update_priority(intersection.id, update_items, commit=False)

            if payload.reset_missing:
                for approach in approaches:
                    if approach.id in touched_ids:
                        continue
                    self._approach_repository.update(
                        approach,
                        commit=False,
                        role=None,
                        priority_rank=None,
                    )

            self._approach_repository.commit()
        except IntegrityError as exc:
            self._approach_repository.rollback()
            raise ConflictError("Priority scheme update violates constraints") from exc
        except Exception:
            self._approach_repository.rollback()
            raise

        return self.get_scheme(project_id, intersection_id)

    def validate(self, project_id: str, intersection_id: str) -> dict[str, object]:
        intersection = self._get_intersection(project_id, intersection_id)
        approaches = self._approach_repository.list_by_intersection(intersection.id)
        summary, conflict_errors, conflict_warnings = self._build_summary(approaches)

        missing_roles = [item.id for item in approaches if item.role is None]

        warnings: list[str] = list(conflict_warnings)
        errors: list[str] = list(conflict_errors)

        if not approaches:
            errors.append("Intersection has no approaches")
        if missing_roles:
            errors.append("Some approaches have no assigned role")
        if summary["main_count"] == 0:
            errors.append("Priority scheme requires at least one main approach")

        is_complete = bool(approaches) and len(missing_roles) == 0 and summary["main_count"] > 0
        is_valid = len(errors) == 0

        return {
            "intersection_id": intersection.id,
            "is_valid": is_valid,
            "is_complete": is_complete,
            "missing_roles": missing_roles,
            "warnings": warnings,
            "errors": errors,
            "exportable_as_priority_controlled": is_valid,
        }

    def _get_intersection(self, project_id: str, intersection_id: str) -> IntersectionModel:
        self._project_service.get(project_id)
        intersection = self._intersection_repository.get_in_project(project_id, intersection_id)
        if intersection is None:
            raise NotFoundError(f"Intersection '{intersection_id}' not found in project '{project_id}'")
        return intersection

    @staticmethod
    def _find_duplicates(items: list[str]) -> list[str]:
        seen: set[str] = set()
        duplicates: set[str] = set()
        for item in items:
            if item in seen:
                duplicates.add(item)
            seen.add(item)
        return sorted(duplicates)

    def _build_summary(self, approaches: list[IntersectionApproachModel]) -> tuple[dict[str, object], list[str], list[str]]:
        main_count = sum(1 for item in approaches if item.role == "main")
        secondary_count = sum(1 for item in approaches if item.role == "secondary")
        unassigned_count = sum(1 for item in approaches if item.role is None)

        errors: list[str] = []
        warnings: list[str] = []

        rank_without_role = [item.id for item in approaches if item.role is None and item.priority_rank is not None]
        if rank_without_role:
            errors.append("priority_rank is set on approaches without role")

        role_rank_to_approaches: dict[tuple[str, int], list[str]] = defaultdict(list)
        for item in approaches:
            if item.role is None or item.priority_rank is None:
                continue
            role_rank_to_approaches[(item.role, item.priority_rank)].append(item.id)

        duplicated_rank_bindings = [
            (role, rank, ids)
            for (role, rank), ids in role_rank_to_approaches.items()
            if len(ids) > 1
        ]
        if duplicated_rank_bindings:
            errors.append("Duplicate priority_rank values detected within same role")

        has_conflicts = len(errors) > 0
        is_complete = bool(approaches) and unassigned_count == 0 and main_count > 0 and not has_conflicts

        summary = {
            "main_count": main_count,
            "secondary_count": secondary_count,
            "unassigned_count": unassigned_count,
            "is_complete": is_complete,
            "has_conflicts": has_conflicts,
        }
        return summary, errors, warnings
