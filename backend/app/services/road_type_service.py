"""Business operations for road types."""

from sqlalchemy.exc import IntegrityError

from app.repositories.road_type import RoadTypeRepository
from app.schemas.road_type import RoadTypeCreate, RoadTypeUpdate
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.project_service import ProjectService


class RoadTypeService:
    """Application service for road type defaults."""

    def __init__(self, repository: RoadTypeRepository, project_service: ProjectService):
        self._repository = repository
        self._project_service = project_service

    def create(self, project_id: str, payload: RoadTypeCreate):
        self._project_service.get(project_id)
        self._validate_numeric_fields(payload.num_lanes, payload.speed, payload.width, payload.sidewalk_width)

        try:
            return self._repository.create(
                project_id=project_id,
                code=payload.code,
                name=payload.name,
                num_lanes=payload.num_lanes,
                speed=payload.speed,
                priority=payload.priority,
                width=payload.width,
                sidewalk_width=payload.sidewalk_width,
            )
        except IntegrityError as exc:
            self._repository.rollback()
            raise ConflictError(f"RoadType with code '{payload.code}' already exists in project") from exc

    def list_by_project(self, project_id: str):
        self._project_service.get(project_id)
        return self._repository.list_by_project(project_id)

    def update(self, project_id: str, road_type_id: str, payload: RoadTypeUpdate):
        if not payload.model_fields_set:
            raise ValidationError("PATCH payload must include at least one field")

        road_type = self._repository.get_in_project(project_id, road_type_id)
        if road_type is None:
            raise NotFoundError(f"RoadType '{road_type_id}' not found in project '{project_id}'")

        update_data = payload.model_dump(exclude_unset=True)
        if "code" in update_data and update_data["code"] is None:
            raise ValidationError("code cannot be null")
        self._validate_numeric_fields(
            update_data.get("num_lanes"),
            update_data.get("speed"),
            update_data.get("width"),
            update_data.get("sidewalk_width"),
        )

        try:
            return self._repository.update(road_type, **update_data)
        except IntegrityError as exc:
            self._repository.rollback()
            raise ConflictError("RoadType update violates unique constraints") from exc

    @staticmethod
    def _validate_numeric_fields(
        num_lanes: int | None,
        speed: float | None,
        width: float | None,
        sidewalk_width: float | None,
    ) -> None:
        if num_lanes is not None and num_lanes <= 0:
            raise ValidationError("num_lanes must be > 0")
        if speed is not None and speed <= 0:
            raise ValidationError("speed must be > 0")
        if width is not None and width <= 0:
            raise ValidationError("width must be > 0")
        if sidewalk_width is not None and sidewalk_width < 0:
            raise ValidationError("sidewalk_width must be >= 0")
