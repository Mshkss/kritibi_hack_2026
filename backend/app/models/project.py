"""SQLAlchemy model for Project."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProjectModel(Base):
    """Root aggregate for road network modeling."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    nodes: Mapped[list["NodeModel"]] = relationship(
        "NodeModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    edges: Mapped[list["EdgeModel"]] = relationship(
        "EdgeModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    road_types: Mapped[list["RoadTypeModel"]] = relationship(
        "RoadTypeModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    connections: Mapped[list["ConnectionModel"]] = relationship(
        "ConnectionModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    intersections: Mapped[list["IntersectionModel"]] = relationship(
        "IntersectionModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    intersection_approaches: Mapped[list["IntersectionApproachModel"]] = relationship(
        "IntersectionApproachModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    movements: Mapped[list["MovementModel"]] = relationship(
        "MovementModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    traffic_signs: Mapped[list["TrafficSignModel"]] = relationship(
        "TrafficSignModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    pedestrian_crossings: Mapped[list["PedestrianCrossingModel"]] = relationship(
        "PedestrianCrossingModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
