"""Service for generating and listing priority traffic signs."""

from sqlalchemy.exc import IntegrityError

from app.models.intersection import IntersectionModel
from app.repositories.intersection import IntersectionRepository
from app.repositories.intersection_approach import IntersectionApproachRepository
from app.repositories.traffic_sign import TrafficSignRepository
from app.schemas.intersection import SignGenerationRequest
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.priority_scheme_service import PrioritySchemeService
from app.services.project_service import ProjectService


class SignGenerationService:
    """Generates persisted traffic signs from approach priority scheme."""

    def __init__(
        self,
        intersection_repository: IntersectionRepository,
        approach_repository: IntersectionApproachRepository,
        traffic_sign_repository: TrafficSignRepository,
        priority_scheme_service: PrioritySchemeService,
        project_service: ProjectService,
    ):
        self._intersection_repository = intersection_repository
        self._approach_repository = approach_repository
        self._traffic_sign_repository = traffic_sign_repository
        self._priority_scheme_service = priority_scheme_service
        self._project_service = project_service

    def list_signs(self, project_id: str, intersection_id: str):
        intersection = self._get_intersection(project_id, intersection_id)
        return self._traffic_sign_repository.list_by_intersection(project_id, intersection.id)

    def generate(
        self,
        project_id: str,
        intersection_id: str,
        payload: SignGenerationRequest,
    ) -> dict[str, object]:
        intersection = self._get_intersection(project_id, intersection_id)
        validation = self._priority_scheme_service.validate(project_id, intersection.id)
        if not validation["exportable_as_priority_controlled"]:
            reason = "; ".join(validation["errors"]) if validation["errors"] else "priority scheme is invalid"
            raise ValidationError(f"Cannot generate signs: {reason}")

        approaches = self._approach_repository.list_by_intersection(intersection.id)
        desired_items: list[dict[str, object]] = []
        for approach in approaches:
            if approach.role == "main":
                sign_type = "main_road"
            elif approach.role == "secondary":
                sign_type = payload.secondary_sign_type
            else:
                continue

            desired_items.append(
                {
                    "project_id": project_id,
                    "intersection_id": intersection.id,
                    "approach_id": approach.id,
                    "node_id": intersection.node_id,
                    "edge_id": approach.incoming_edge_id,
                    "sign_type": sign_type,
                    "generated": True,
                    "payload": {
                        "source": "priority_scheme",
                        "role": approach.role,
                        "priority_rank": approach.priority_rank,
                    },
                }
            )

        desired_keys = {(str(item["approach_id"]), str(item["sign_type"])) for item in desired_items}
        existing_generated = self._traffic_sign_repository.list_by_intersection(
            project_id,
            intersection.id,
            generated=True,
        )
        existing_by_key = {(item.approach_id or "", item.sign_type): item for item in existing_generated}

        create_items: list[dict[str, object]] = []
        updated_count = 0
        stale_ids: list[str] = []

        try:
            for item in desired_items:
                key = (str(item["approach_id"]), str(item["sign_type"]))
                existing = existing_by_key.get(key)
                if existing is None:
                    create_items.append(item)
                    continue

                update_payload: dict[str, object] = {}
                if existing.node_id != item["node_id"]:
                    update_payload["node_id"] = item["node_id"]
                if existing.edge_id != item["edge_id"]:
                    update_payload["edge_id"] = item["edge_id"]
                if existing.intersection_id != item["intersection_id"]:
                    update_payload["intersection_id"] = item["intersection_id"]
                if existing.approach_id != item["approach_id"]:
                    update_payload["approach_id"] = item["approach_id"]
                if existing.payload != item["payload"]:
                    update_payload["payload"] = item["payload"]

                if update_payload:
                    self._traffic_sign_repository.update(existing, commit=False, **update_payload)
                    updated_count += 1

            for existing in existing_generated:
                key = (existing.approach_id or "", existing.sign_type)
                if key not in desired_keys:
                    stale_ids.append(existing.id)

            deleted_count = self._traffic_sign_repository.delete_many(stale_ids, commit=False) if stale_ids else 0
            created = self._traffic_sign_repository.bulk_create(create_items, commit=False) if create_items else []
            self._traffic_sign_repository.commit()
        except IntegrityError as exc:
            self._traffic_sign_repository.rollback()
            raise ConflictError("Generated sign sync violates constraints") from exc
        except Exception:
            self._traffic_sign_repository.rollback()
            raise

        signs = self._traffic_sign_repository.list_by_intersection(project_id, intersection.id)
        diagnostics = [
            f"approaches={len(approaches)}",
            f"desired_generated={len(desired_items)}",
            f"created={len(created)}",
            f"updated={updated_count}",
            f"deleted_stale_generated={deleted_count}",
            f"secondary_sign_type={payload.secondary_sign_type}",
        ]

        return {
            "intersection_id": intersection.id,
            "secondary_sign_type": payload.secondary_sign_type,
            "created_count": len(created),
            "updated_count": updated_count,
            "deleted_count": deleted_count,
            "signs": signs,
            "diagnostics": diagnostics,
        }

    def export_hints(self, project_id: str, intersection_id: str) -> dict[str, object]:
        intersection = self._get_intersection(project_id, intersection_id)
        validation = self._priority_scheme_service.validate(project_id, intersection.id)
        approaches = self._approach_repository.list_by_intersection(intersection.id)
        generated_signs = self._traffic_sign_repository.list_by_intersection(project_id, intersection.id, generated=True)

        sign_types = {item.sign_type for item in generated_signs}
        secondary_count = sum(1 for item in approaches if item.role == "secondary")

        priority_controlled = bool(validation["exportable_as_priority_controlled"])
        node_type: str | None = None
        if priority_controlled:
            node_type = "priority_stop" if "stop" in sign_types else "priority"

        requires_stop_signs = "stop" in sign_types
        if not generated_signs and secondary_count > 0:
            requires_yield_signs = True
        else:
            requires_yield_signs = "yield" in sign_types

        notes: list[str] = []
        if not priority_controlled:
            notes.extend(str(err) for err in validation["errors"])
        if priority_controlled and secondary_count > 0 and not generated_signs:
            notes.append("No generated signs yet; default secondary sign policy is yield")

        return {
            "intersection_id": intersection.id,
            "node_type": node_type,
            "priority_controlled": priority_controlled,
            "requires_stop_signs": requires_stop_signs,
            "requires_yield_signs": requires_yield_signs,
            "notes": notes,
        }

    def _get_intersection(self, project_id: str, intersection_id: str) -> IntersectionModel:
        self._project_service.get(project_id)
        intersection = self._intersection_repository.get_in_project(project_id, intersection_id)
        if intersection is None:
            raise NotFoundError(f"Intersection '{intersection_id}' not found in project '{project_id}'")
        return intersection
