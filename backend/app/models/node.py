"""SQLAlchemy model for Node."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NodeModel(Base):
    """Topological node in project road graph."""

    __tablename__ = "nodes"
    __table_args__ = (
        UniqueConstraint("project_id", "code", name="uq_nodes_project_code"),
        Index("ix_nodes_project_id", "project_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(128), nullable=False)
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    type: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    project: Mapped["ProjectModel"] = relationship("ProjectModel", back_populates="nodes")
    outgoing_edges: Mapped[list["EdgeModel"]] = relationship(
        "EdgeModel",
        back_populates="from_node",
        foreign_keys="EdgeModel.from_node_id",
    )
    incoming_edges: Mapped[list["EdgeModel"]] = relationship(
        "EdgeModel",
        back_populates="to_node",
        foreign_keys="EdgeModel.to_node_id",
    )
    via_connections: Mapped[list["ConnectionModel"]] = relationship(
        "ConnectionModel",
        back_populates="via_node",
        foreign_keys="ConnectionModel.via_node_id",
        passive_deletes=True,
    )
