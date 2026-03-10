"""Business operations for Project."""

from app.models.project import ProjectModel
from app.repositories.project import ProjectRepository
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.services.errors import NotFoundError, ValidationError


class ProjectNotFoundError(NotFoundError):
    """Raised when project does not exist."""


class EmptyPatchError(ValidationError):
    """Raised when PATCH body has no fields."""


class ProjectService:
    """Application service for Project aggregate."""

    def __init__(self, repository: ProjectRepository):
        self._repository = repository

    def create(self, payload: ProjectCreate) -> ProjectModel:
        return self._repository.create(name=payload.name, description=payload.description)

    def get(self, project_id: str) -> ProjectModel:
        project = self._repository.get(project_id)
        if project is None:
            raise ProjectNotFoundError(f"Project '{project_id}' not found")
        return project

    def list(self, *, limit: int = 100, offset: int = 0) -> list[ProjectModel]:
        return self._repository.list(limit=limit, offset=offset)

    def update(self, project_id: str, payload: ProjectUpdate) -> ProjectModel:
        if not payload.model_fields_set:
            raise EmptyPatchError("PATCH payload must include at least one field")

        project = self.get(project_id)
        update_data = payload.model_dump(exclude_unset=True)
        return self._repository.update(project, **update_data)

    def delete(self, project_id: str) -> None:
        project = self.get(project_id)
        self._repository.delete(project)

    def ensure_belongs_to_project(self, *, project_id: str, entity_project_id: str, entity_name: str) -> None:
        if project_id != entity_project_id:
            raise ValidationError(f"{entity_name} does not belong to project '{project_id}'")
