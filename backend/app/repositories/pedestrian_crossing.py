"""Repository for PedestrianCrossing persistence."""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.intersection_approach import IntersectionApproachModel
from app.models.pedestrian_crossing import PedestrianCrossingModel


class PedestrianCrossingRepository:
    """Persistence operations for pedestrian crossings."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, crossing_id: str) -> PedestrianCrossingModel | None:
        stmt = (
            select(PedestrianCrossingModel)
            .options(
                selectinload(PedestrianCrossingModel.approach).selectinload(IntersectionApproachModel.incoming_edge),
            )
            .where(PedestrianCrossingModel.id == crossing_id)
        )
        return self.session.scalar(stmt)

    def get_in_intersection(self, intersection_id: str, crossing_id: str) -> PedestrianCrossingModel | None:
        stmt = (
            select(PedestrianCrossingModel)
            .options(
                selectinload(PedestrianCrossingModel.approach).selectinload(IntersectionApproachModel.incoming_edge),
            )
            .where(
                PedestrianCrossingModel.intersection_id == intersection_id,
                PedestrianCrossingModel.id == crossing_id,
            )
        )
        return self.session.scalar(stmt)

    def list_by_intersection(self, intersection_id: str) -> list[PedestrianCrossingModel]:
        stmt = (
            select(PedestrianCrossingModel)
            .options(
                selectinload(PedestrianCrossingModel.approach).selectinload(IntersectionApproachModel.incoming_edge),
            )
            .where(PedestrianCrossingModel.intersection_id == intersection_id)
            .order_by(PedestrianCrossingModel.created_at.asc())
        )
        return list(self.session.scalars(stmt).all())

    def exists_for_side(self, intersection_id: str, side_key: str, *, exclude_id: str | None = None) -> bool:
        stmt = select(PedestrianCrossingModel.id).where(
            PedestrianCrossingModel.intersection_id == intersection_id,
            PedestrianCrossingModel.side_key == side_key,
        )
        if exclude_id is not None:
            stmt = stmt.where(PedestrianCrossingModel.id != exclude_id)
        return self.session.scalar(stmt) is not None

    def create(
        self,
        *,
        project_id: str,
        intersection_id: str,
        approach_id: str | None,
        side_key: str,
        is_enabled: bool = True,
        name: str | None = None,
        crossing_kind: str | None = None,
        commit: bool = True,
    ) -> PedestrianCrossingModel:
        crossing = PedestrianCrossingModel(
            project_id=project_id,
            intersection_id=intersection_id,
            approach_id=approach_id,
            side_key=side_key,
            is_enabled=is_enabled,
            name=name,
            crossing_kind=crossing_kind,
        )
        self.session.add(crossing)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(crossing.id)  # type: ignore[return-value]
        return crossing

    def update(
        self,
        crossing: PedestrianCrossingModel,
        *,
        commit: bool = True,
        **kwargs: object,
    ) -> PedestrianCrossingModel:
        for field, value in kwargs.items():
            setattr(crossing, field, value)
        self.session.add(crossing)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(crossing.id)  # type: ignore[return-value]
        return crossing

    def delete(self, crossing: PedestrianCrossingModel, *, commit: bool = True) -> None:
        self.session.delete(crossing)
        self.session.flush()
        if commit:
            self.session.commit()

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
