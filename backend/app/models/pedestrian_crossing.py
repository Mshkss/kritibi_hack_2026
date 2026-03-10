"""SQLAlchemy model for intersection pedestrian crossings."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PedestrianCrossingModel(Base):
    """Editor-level pedestrian crossing attached to intersection side."""

    __tablename__ = "pedestrian_crossings"
    __table_args__ = (
        UniqueConstraint("intersection_id", "side_key", name="uq_ped_crossings_intersection_side"),
        CheckConstraint(
            "crossing_kind in ('zebra', 'signalized', 'uncontrolled') or crossing_kind is null",
            name="ck_ped_crossings_kind",
        ),
        Index("ix_ped_crossings_project_id", "project_id"),
        Index("ix_ped_crossings_intersection_id", "intersection_id"),
        Index("ix_ped_crossings_approach_id", "approach_id"),
        Index("ix_ped_crossings_project_intersection", "project_id", "intersection_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    intersection_id: Mapped[str] = mapped_column(ForeignKey("intersections.id", ondelete="CASCADE"), nullable=False)
    approach_id: Mapped[str | None] = mapped_column(
        ForeignKey("intersection_approaches.id", ondelete="SET NULL"),
        nullable=True,
    )
    side_key: Mapped[str] = mapped_column(String(255), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    crossing_kind: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    project: Mapped["ProjectModel"] = relationship("ProjectModel", back_populates="pedestrian_crossings")
    intersection: Mapped["IntersectionModel"] = relationship("IntersectionModel", back_populates="pedestrian_crossings")
    approach: Mapped["IntersectionApproachModel | None"] = relationship(
        "IntersectionApproachModel",
        back_populates="pedestrian_crossings",
    )
