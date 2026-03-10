"""SQLAlchemy model for intersection-level movement over connection."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MovementModel(Base):
    """Intersection editor movement wrapping one connection."""

    __tablename__ = "movements"
    __table_args__ = (
        UniqueConstraint("intersection_id", "connection_id", name="uq_movements_intersection_connection"),
        CheckConstraint("from_lane_index >= 0", name="ck_movements_from_lane_non_negative"),
        CheckConstraint("to_lane_index >= 0", name="ck_movements_to_lane_non_negative"),
        Index("ix_movements_project_id", "project_id"),
        Index("ix_movements_intersection_id", "intersection_id"),
        Index("ix_movements_approach_id", "approach_id"),
        Index("ix_movements_connection_id", "connection_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    intersection_id: Mapped[str] = mapped_column(ForeignKey("intersections.id", ondelete="CASCADE"), nullable=False)
    approach_id: Mapped[str] = mapped_column(ForeignKey("intersection_approaches.id", ondelete="CASCADE"), nullable=False)
    connection_id: Mapped[str] = mapped_column(ForeignKey("connections.id", ondelete="CASCADE"), nullable=False)
    from_edge_id: Mapped[str] = mapped_column(ForeignKey("edges.id", ondelete="CASCADE"), nullable=False)
    to_edge_id: Mapped[str] = mapped_column(ForeignKey("edges.id", ondelete="CASCADE"), nullable=False)
    from_lane_index: Mapped[int] = mapped_column(Integer, nullable=False)
    to_lane_index: Mapped[int] = mapped_column(Integer, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    movement_kind: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    project: Mapped["ProjectModel"] = relationship("ProjectModel", back_populates="movements")
    intersection: Mapped["IntersectionModel"] = relationship("IntersectionModel", back_populates="movements")
    approach: Mapped["IntersectionApproachModel"] = relationship("IntersectionApproachModel", back_populates="movements")
    connection: Mapped["ConnectionModel"] = relationship("ConnectionModel", back_populates="movements")
    from_edge: Mapped["EdgeModel"] = relationship(
        "EdgeModel",
        back_populates="movements_from_edge",
        foreign_keys=[from_edge_id],
    )
    to_edge: Mapped["EdgeModel"] = relationship(
        "EdgeModel",
        back_populates="movements_to_edge",
        foreign_keys=[to_edge_id],
    )
