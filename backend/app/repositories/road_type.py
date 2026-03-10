"""Repository for RoadType persistence."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.road_type import RoadTypeModel


class RoadTypeRepository:
    """Persistence operations for road types."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, road_type_id: str) -> RoadTypeModel | None:
        return self.session.get(RoadTypeModel, road_type_id)

    def get_in_project(self, project_id: str, road_type_id: str) -> RoadTypeModel | None:
        stmt = select(RoadTypeModel).where(RoadTypeModel.project_id == project_id, RoadTypeModel.id == road_type_id)
        return self.session.scalar(stmt)

    def list_by_project(self, project_id: str) -> list[RoadTypeModel]:
        stmt = select(RoadTypeModel).where(RoadTypeModel.project_id == project_id).order_by(RoadTypeModel.created_at.asc())
        return list(self.session.scalars(stmt).all())

    def create(
        self,
        *,
        project_id: str,
        code: str,
        name: str | None,
        num_lanes: int | None,
        speed: float | None,
        priority: int | None,
        width: float | None,
        sidewalk_width: float | None,
        commit: bool = True,
    ) -> RoadTypeModel:
        road_type = RoadTypeModel(
            project_id=project_id,
            code=code,
            name=name,
            num_lanes=num_lanes,
            speed=speed,
            priority=priority,
            width=width,
            sidewalk_width=sidewalk_width,
        )
        self.session.add(road_type)
        self.session.flush()
        if commit:
            self.session.commit()
            self.session.refresh(road_type)
        return road_type

    def update(self, road_type: RoadTypeModel, *, commit: bool = True, **kwargs: object) -> RoadTypeModel:
        for field, value in kwargs.items():
            setattr(road_type, field, value)
        self.session.add(road_type)
        self.session.flush()
        if commit:
            self.session.commit()
            self.session.refresh(road_type)
        return road_type

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
