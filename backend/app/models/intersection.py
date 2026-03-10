"""SQLAlchemy model for intersection editor configuration over node."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IntersectionModel(Base):
    """Logical intersection config attached to one node."""

    __tablename__ = "intersections"
    __table_args__ = (
        UniqueConstraint("node_id", name="uq_intersections_node_id"),
        CheckConstraint("kind in ('crossroad', 'roundabout')", name="ck_intersections_kind"),
        Index("ix_intersections_project_id", "project_id"),
        Index("ix_intersections_node_id", "node_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="crossroad")
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    project: Mapped["ProjectModel"] = relationship("ProjectModel", back_populates="intersections")
    node: Mapped["NodeModel"] = relationship("NodeModel", back_populates="intersection")
    approaches: Mapped[list["IntersectionApproachModel"]] = relationship(
        "IntersectionApproachModel",
        back_populates="intersection",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="IntersectionApproachModel.order_index",
    )
    movements: Mapped[list["MovementModel"]] = relationship(
        "MovementModel",
        back_populates="intersection",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
