"""Repository for Intersection persistence."""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.intersection import IntersectionModel


class IntersectionRepository:
    """Persistence operations for intersections."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, intersection_id: str) -> IntersectionModel | None:
        stmt = (
            select(IntersectionModel)
            .options(selectinload(IntersectionModel.node))
            .where(IntersectionModel.id == intersection_id)
        )
        return self.session.scalar(stmt)

    def get_in_project(self, project_id: str, intersection_id: str) -> IntersectionModel | None:
        stmt = (
            select(IntersectionModel)
            .options(selectinload(IntersectionModel.node))
            .where(IntersectionModel.project_id == project_id, IntersectionModel.id == intersection_id)
        )
        return self.session.scalar(stmt)

    def get_by_node(self, project_id: str, node_id: str) -> IntersectionModel | None:
        stmt = (
            select(IntersectionModel)
            .options(selectinload(IntersectionModel.node))
            .where(IntersectionModel.project_id == project_id, IntersectionModel.node_id == node_id)
        )
        return self.session.scalar(stmt)

    def list_by_project(self, project_id: str) -> list[IntersectionModel]:
        stmt = (
            select(IntersectionModel)
            .options(selectinload(IntersectionModel.node))
            .where(IntersectionModel.project_id == project_id)
            .order_by(IntersectionModel.created_at.asc())
        )
        return list(self.session.scalars(stmt).all())

    def create(
        self,
        *,
        project_id: str,
        node_id: str,
        kind: str,
        name: str | None,
        commit: bool = True,
    ) -> IntersectionModel:
        intersection = IntersectionModel(
            project_id=project_id,
            node_id=node_id,
            kind=kind,
            name=name,
        )
        self.session.add(intersection)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(intersection.id)  # type: ignore[return-value]
        return intersection

    def update(self, intersection: IntersectionModel, *, commit: bool = True, **kwargs: object) -> IntersectionModel:
        for field, value in kwargs.items():
            setattr(intersection, field, value)
        self.session.add(intersection)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(intersection.id)  # type: ignore[return-value]
        return intersection

    def delete(self, intersection: IntersectionModel, *, commit: bool = True) -> None:
        self.session.delete(intersection)
        self.session.flush()
        if commit:
            self.session.commit()

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
