"""Shared API dependencies."""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.project import ProjectRepository
from app.services.project_service import ProjectService


def get_project_service(db: Session = Depends(get_db)) -> ProjectService:
    """Build ProjectService for request scope."""
    repository = ProjectRepository(db)
    return ProjectService(repository)


__all__ = ["get_db", "get_project_service"]
