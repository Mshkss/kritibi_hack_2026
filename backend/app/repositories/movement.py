"""Repository for Movement persistence."""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.movement import MovementModel


class MovementRepository:
    """Persistence operations for movements."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, movement_id: str) -> MovementModel | None:
        stmt = (
            select(MovementModel)
            .options(
                selectinload(MovementModel.approach),
                selectinload(MovementModel.connection),
                selectinload(MovementModel.from_edge),
                selectinload(MovementModel.to_edge),
            )
            .where(MovementModel.id == movement_id)
        )
        return self.session.scalar(stmt)

    def get_in_intersection(self, intersection_id: str, movement_id: str) -> MovementModel | None:
        stmt = (
            select(MovementModel)
            .options(
                selectinload(MovementModel.approach),
                selectinload(MovementModel.connection),
                selectinload(MovementModel.from_edge),
                selectinload(MovementModel.to_edge),
            )
            .where(MovementModel.intersection_id == intersection_id, MovementModel.id == movement_id)
        )
        return self.session.scalar(stmt)

    def get_by_connection(self, intersection_id: str, connection_id: str) -> MovementModel | None:
        stmt = (
            select(MovementModel)
            .options(
                selectinload(MovementModel.approach),
                selectinload(MovementModel.connection),
                selectinload(MovementModel.from_edge),
                selectinload(MovementModel.to_edge),
            )
            .where(MovementModel.intersection_id == intersection_id, MovementModel.connection_id == connection_id)
        )
        return self.session.scalar(stmt)

    def list_by_intersection(self, intersection_id: str) -> list[MovementModel]:
        stmt = (
            select(MovementModel)
            .options(
                selectinload(MovementModel.approach),
                selectinload(MovementModel.connection),
                selectinload(MovementModel.from_edge),
                selectinload(MovementModel.to_edge),
            )
            .where(MovementModel.intersection_id == intersection_id)
            .order_by(MovementModel.created_at.asc())
        )
        return list(self.session.scalars(stmt).all())

    def create(
        self,
        *,
        project_id: str,
        intersection_id: str,
        approach_id: str,
        connection_id: str,
        from_edge_id: str,
        to_edge_id: str,
        from_lane_index: int,
        to_lane_index: int,
        is_enabled: bool = True,
        movement_kind: str | None = None,
        commit: bool = True,
    ) -> MovementModel:
        movement = MovementModel(
            project_id=project_id,
            intersection_id=intersection_id,
            approach_id=approach_id,
            connection_id=connection_id,
            from_edge_id=from_edge_id,
            to_edge_id=to_edge_id,
            from_lane_index=from_lane_index,
            to_lane_index=to_lane_index,
            is_enabled=is_enabled,
            movement_kind=movement_kind,
        )
        self.session.add(movement)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(movement.id)  # type: ignore[return-value]
        return movement

    def bulk_create(self, items: list[dict[str, object]], *, commit: bool = True) -> list[MovementModel]:
        created: list[MovementModel] = []
        for item in items:
            created.append(
                self.create(
                    project_id=str(item["project_id"]),
                    intersection_id=str(item["intersection_id"]),
                    approach_id=str(item["approach_id"]),
                    connection_id=str(item["connection_id"]),
                    from_edge_id=str(item["from_edge_id"]),
                    to_edge_id=str(item["to_edge_id"]),
                    from_lane_index=int(item["from_lane_index"]),
                    to_lane_index=int(item["to_lane_index"]),
                    is_enabled=bool(item.get("is_enabled", True)),
                    movement_kind=str(item["movement_kind"]) if item.get("movement_kind") is not None else None,
                    commit=False,
                )
            )
        if commit:
            self.session.commit()
            ids = [item.id for item in created]
            if not ids:
                return []
            stmt = (
                select(MovementModel)
                .options(
                    selectinload(MovementModel.approach),
                    selectinload(MovementModel.connection),
                    selectinload(MovementModel.from_edge),
                    selectinload(MovementModel.to_edge),
                )
                .where(MovementModel.id.in_(ids))
                .order_by(MovementModel.created_at.asc())
            )
            return list(self.session.scalars(stmt).all())
        return created

    def update(self, movement: MovementModel, *, commit: bool = True, **kwargs: object) -> MovementModel:
        for field, value in kwargs.items():
            setattr(movement, field, value)
        self.session.add(movement)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(movement.id)  # type: ignore[return-value]
        return movement

    def delete_many(self, movement_ids: list[str], *, commit: bool = True) -> int:
        if not movement_ids:
            return 0
        stmt = select(MovementModel).where(MovementModel.id.in_(movement_ids))
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
