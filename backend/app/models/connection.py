"""SQLAlchemy model for lane-level directed connection via node."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ConnectionModel(Base):
    """Lane-level transition from incoming edge to outgoing edge via node."""

    __tablename__ = "connections"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "from_edge_id",
            "to_edge_id",
            "from_lane_index",
            "to_lane_index",
            name="uq_connections_project_from_to_lanes",
        ),
        CheckConstraint("from_lane_index >= 0", name="ck_connections_from_lane_non_negative"),
        CheckConstraint("to_lane_index >= 0", name="ck_connections_to_lane_non_negative"),
        CheckConstraint("from_edge_id <> to_edge_id", name="ck_connections_from_to_edge_different"),
        Index("ix_connections_project_id", "project_id"),
        Index("ix_connections_via_node_id", "via_node_id"),
        Index("ix_connections_from_edge_id", "from_edge_id"),
        Index("ix_connections_to_edge_id", "to_edge_id"),
        Index("ix_connections_project_via_node", "project_id", "via_node_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    via_node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    from_edge_id: Mapped[str] = mapped_column(ForeignKey("edges.id", ondelete="CASCADE"), nullable=False)
    to_edge_id: Mapped[str] = mapped_column(ForeignKey("edges.id", ondelete="CASCADE"), nullable=False)
    from_lane_index: Mapped[int] = mapped_column(Integer, nullable=False)
    to_lane_index: Mapped[int] = mapped_column(Integer, nullable=False)
    uncontrolled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    project: Mapped["ProjectModel"] = relationship("ProjectModel", back_populates="connections")
    via_node: Mapped["NodeModel"] = relationship("NodeModel", back_populates="via_connections")
    from_edge: Mapped["EdgeModel"] = relationship(
        "EdgeModel",
        back_populates="outgoing_connections",
        foreign_keys=[from_edge_id],
    )
    to_edge: Mapped["EdgeModel"] = relationship(
        "EdgeModel",
        back_populates="incoming_connections",
        foreign_keys=[to_edge_id],
    )
