"""SQLAlchemy model for intersection incoming approaches."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IntersectionApproachModel(Base):
    """Represents one incoming edge approach for intersection editor."""

    __tablename__ = "intersection_approaches"
    __table_args__ = (
        UniqueConstraint("intersection_id", "incoming_edge_id", name="uq_approaches_intersection_incoming_edge"),
        CheckConstraint("order_index is null or order_index >= 0", name="ck_approaches_order_index_non_negative"),
        CheckConstraint("role in ('main', 'secondary') or role is null", name="ck_approaches_role"),
        CheckConstraint("priority_rank is null or priority_rank >= 0", name="ck_approaches_priority_rank_non_negative"),
        Index("ix_approaches_project_id", "project_id"),
        Index("ix_approaches_intersection_id", "intersection_id"),
        Index("ix_approaches_incoming_edge_id", "incoming_edge_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    intersection_id: Mapped[str] = mapped_column(ForeignKey("intersections.id", ondelete="CASCADE"), nullable=False)
    incoming_edge_id: Mapped[str] = mapped_column(ForeignKey("edges.id", ondelete="CASCADE"), nullable=False)
    order_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    priority_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    project: Mapped["ProjectModel"] = relationship("ProjectModel", back_populates="intersection_approaches")
    intersection: Mapped["IntersectionModel"] = relationship("IntersectionModel", back_populates="approaches")
    incoming_edge: Mapped["EdgeModel"] = relationship("EdgeModel", back_populates="incoming_approaches")
    movements: Mapped[list["MovementModel"]] = relationship(
        "MovementModel",
        back_populates="approach",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    traffic_signs: Mapped[list["TrafficSignModel"]] = relationship(
        "TrafficSignModel",
        back_populates="approach",
        passive_deletes=True,
    )
