"""Repository for Project persistence."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.project import ProjectModel


class ProjectRepository:
    """Persistence operations for ProjectModel."""

    def __init__(self, session: Session):
        self._session = session

    def get(self, project_id: str) -> ProjectModel | None:
        return self._session.get(ProjectModel, project_id)

    def list(self, *, limit: int = 100, offset: int = 0) -> list[ProjectModel]:
        stmt = (
            select(ProjectModel)
            .order_by(ProjectModel.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(self._session.scalars(stmt).all())

    def create(self, *, name: str, description: str | None) -> ProjectModel:
        project = ProjectModel(name=name, description=description)
        self._session.add(project)
        self._session.commit()
        self._session.refresh(project)
        return project

    def update(self, project: ProjectModel, **kwargs: object) -> ProjectModel:
        for field, value in kwargs.items():
            setattr(project, field, value)
        self._session.add(project)
        self._session.commit()
        self._session.refresh(project)
        return project

    def delete(self, project: ProjectModel) -> None:
        self._session.delete(project)
        self._session.commit()
