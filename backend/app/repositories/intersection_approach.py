"""Repository for IntersectionApproach persistence."""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.intersection_approach import IntersectionApproachModel


class IntersectionApproachRepository:
    """Persistence operations for approaches."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, approach_id: str) -> IntersectionApproachModel | None:
        stmt = (
            select(IntersectionApproachModel)
            .options(selectinload(IntersectionApproachModel.incoming_edge))
            .where(IntersectionApproachModel.id == approach_id)
        )
        return self.session.scalar(stmt)

    def get_in_intersection(self, intersection_id: str, approach_id: str) -> IntersectionApproachModel | None:
        stmt = (
            select(IntersectionApproachModel)
            .options(selectinload(IntersectionApproachModel.incoming_edge))
            .where(
                IntersectionApproachModel.intersection_id == intersection_id,
                IntersectionApproachModel.id == approach_id,
            )
        )
        return self.session.scalar(stmt)

    def get_by_incoming_edge(self, intersection_id: str, incoming_edge_id: str) -> IntersectionApproachModel | None:
        stmt = (
            select(IntersectionApproachModel)
            .options(selectinload(IntersectionApproachModel.incoming_edge))
            .where(
                IntersectionApproachModel.intersection_id == intersection_id,
                IntersectionApproachModel.incoming_edge_id == incoming_edge_id,
            )
        )
        return self.session.scalar(stmt)

    def list_by_intersection(self, intersection_id: str) -> list[IntersectionApproachModel]:
        stmt = (
            select(IntersectionApproachModel)
            .options(selectinload(IntersectionApproachModel.incoming_edge))
            .where(IntersectionApproachModel.intersection_id == intersection_id)
            .order_by(IntersectionApproachModel.order_index.asc(), IntersectionApproachModel.created_at.asc())
        )
        return list(self.session.scalars(stmt).all())

    def create(
        self,
        *,
        project_id: str,
        intersection_id: str,
        incoming_edge_id: str,
        order_index: int | None = None,
        name: str | None = None,
        role: str | None = None,
        priority_rank: int | None = None,
        commit: bool = True,
    ) -> IntersectionApproachModel:
        approach = IntersectionApproachModel(
            project_id=project_id,
            intersection_id=intersection_id,
            incoming_edge_id=incoming_edge_id,
            order_index=order_index,
            name=name,
            role=role,
            priority_rank=priority_rank,
        )
        self.session.add(approach)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(approach.id)  # type: ignore[return-value]
        return approach

    def bulk_create(self, items: list[dict[str, object]], *, commit: bool = True) -> list[IntersectionApproachModel]:
        created: list[IntersectionApproachModel] = []
        for item in items:
            created.append(
                self.create(
                    project_id=str(item["project_id"]),
                    intersection_id=str(item["intersection_id"]),
                    incoming_edge_id=str(item["incoming_edge_id"]),
                    order_index=int(item["order_index"]) if item.get("order_index") is not None else None,
                    name=str(item["name"]) if item.get("name") is not None else None,
                    role=str(item["role"]) if item.get("role") is not None else None,
                    priority_rank=int(item["priority_rank"]) if item.get("priority_rank") is not None else None,
                    commit=False,
                )
            )
        if commit:
            self.session.commit()
            ids = [item.id for item in created]
            if not ids:
                return []
            stmt = (
                select(IntersectionApproachModel)
                .options(selectinload(IntersectionApproachModel.incoming_edge))
                .where(IntersectionApproachModel.id.in_(ids))
                .order_by(IntersectionApproachModel.created_at.asc())
            )
            return list(self.session.scalars(stmt).all())
        return created

    def update(self, approach: IntersectionApproachModel, *, commit: bool = True, **kwargs: object) -> IntersectionApproachModel:
        for field, value in kwargs.items():
            setattr(approach, field, value)
        self.session.add(approach)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(approach.id)  # type: ignore[return-value]
        return approach

    def bulk_update_priority(
        self,
        intersection_id: str,
        items: list[dict[str, object]],
        *,
        commit: bool = True,
    ) -> list[IntersectionApproachModel]:
        if not items:
            if commit:
                self.session.commit()
            return self.list_by_intersection(intersection_id)

        existing = self.list_by_intersection(intersection_id)
        existing_by_id = {item.id: item for item in existing}
        for item in items:
            approach_id = str(item["approach_id"])
            entity = existing_by_id.get(approach_id)
            if entity is None:
                continue
            if "role" in item:
                entity.role = str(item["role"]) if item["role"] is not None else None
            if "priority_rank" in item:
                entity.priority_rank = int(item["priority_rank"]) if item["priority_rank"] is not None else None
            self.session.add(entity)

        self.session.flush()
        if commit:
            self.session.commit()
            return self.list_by_intersection(intersection_id)
        return existing

    def delete_many(self, approach_ids: list[str], *, commit: bool = True) -> int:
        if not approach_ids:
            return 0
        stmt = select(IntersectionApproachModel).where(IntersectionApproachModel.id.in_(approach_ids))
        entities = list(self.session.scalars(stmt).all())
        for entity in entities:
            self.session.delete(entity)
        self.session.flush()
        if commit:
            self.session.commit()
        return len(entities)

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
