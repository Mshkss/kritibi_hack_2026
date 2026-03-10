"""SQLAlchemy model for generated/manual traffic signs on network entities."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TrafficSignModel(Base):
    """Editor/export-friendly traffic sign record."""

    __tablename__ = "traffic_signs"
    __table_args__ = (
        CheckConstraint("sign_type in ('main_road', 'yield', 'stop')", name="ck_traffic_signs_sign_type"),
        CheckConstraint(
            "intersection_id is not null or node_id is not null or edge_id is not null",
            name="ck_traffic_signs_scope_anchor",
        ),
        UniqueConstraint(
            "project_id",
            "intersection_id",
            "approach_id",
            "sign_type",
            "generated",
            name="uq_traffic_signs_scope_generated",
        ),
        Index("ix_traffic_signs_project_id", "project_id"),
        Index("ix_traffic_signs_intersection_id", "intersection_id"),
        Index("ix_traffic_signs_approach_id", "approach_id"),
        Index("ix_traffic_signs_node_id", "node_id"),
        Index("ix_traffic_signs_edge_id", "edge_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    intersection_id: Mapped[str | None] = mapped_column(
        ForeignKey("intersections.id", ondelete="CASCADE"),
        nullable=True,
    )
    approach_id: Mapped[str | None] = mapped_column(
        ForeignKey("intersection_approaches.id", ondelete="CASCADE"),
        nullable=True,
    )
    node_id: Mapped[str | None] = mapped_column(ForeignKey("nodes.id", ondelete="SET NULL"), nullable=True)
    edge_id: Mapped[str | None] = mapped_column(ForeignKey("edges.id", ondelete="SET NULL"), nullable=True)
    sign_type: Mapped[str] = mapped_column(String(32), nullable=False)
    generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    payload: Mapped[dict[str, object] | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    project: Mapped["ProjectModel"] = relationship("ProjectModel", back_populates="traffic_signs")
    intersection: Mapped["IntersectionModel | None"] = relationship("IntersectionModel", back_populates="traffic_signs")
    approach: Mapped["IntersectionApproachModel | None"] = relationship(
        "IntersectionApproachModel",
        back_populates="traffic_signs",
    )
    node: Mapped["NodeModel | None"] = relationship(
        "NodeModel",
        back_populates="traffic_signs",
        foreign_keys=[node_id],
    )
    edge: Mapped["EdgeModel | None"] = relationship(
        "EdgeModel",
        back_populates="traffic_signs",
        foreign_keys=[edge_id],
    )
