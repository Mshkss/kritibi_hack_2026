"""SQLAlchemy model for Edge."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class EdgeModel(Base):
    """Directed road segment from one node to another."""

    __tablename__ = "edges"
    __table_args__ = (
        UniqueConstraint("project_id", "code", name="uq_edges_project_code"),
        CheckConstraint("from_node_id <> to_node_id", name="ck_edges_from_to_different"),
        Index("ix_edges_project_id", "project_id"),
        Index("ix_edges_from_node_id", "from_node_id"),
        Index("ix_edges_to_node_id", "to_node_id"),
        Index("ix_edges_road_type_id", "road_type_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(128), nullable=False)
    from_node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id", ondelete="RESTRICT"), nullable=False)
    to_node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id", ondelete="RESTRICT"), nullable=False)
    road_type_id: Mapped[str | None] = mapped_column(ForeignKey("road_types.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    priority: Mapped[int | None] = mapped_column(Integer, nullable=True)
    length: Mapped[float | None] = mapped_column(Float, nullable=True)
    width: Mapped[float | None] = mapped_column(Float, nullable=True)
    sidewalk_width: Mapped[float | None] = mapped_column(Float, nullable=True)
    shape: Mapped[list[dict[str, float]]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    project: Mapped["ProjectModel"] = relationship("ProjectModel", back_populates="edges")
    from_node: Mapped["NodeModel"] = relationship(
        "NodeModel",
        back_populates="outgoing_edges",
        foreign_keys=[from_node_id],
    )
    to_node: Mapped["NodeModel"] = relationship(
        "NodeModel",
        back_populates="incoming_edges",
        foreign_keys=[to_node_id],
    )
    road_type: Mapped["RoadTypeModel | None"] = relationship("RoadTypeModel", back_populates="edges")
    lanes: Mapped[list["LaneModel"]] = relationship(
        "LaneModel",
        back_populates="edge",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="LaneModel.index",
    )
    outgoing_connections: Mapped[list["ConnectionModel"]] = relationship(
        "ConnectionModel",
        back_populates="from_edge",
        foreign_keys="ConnectionModel.from_edge_id",
        passive_deletes=True,
    )
    incoming_connections: Mapped[list["ConnectionModel"]] = relationship(
        "ConnectionModel",
        back_populates="to_edge",
        foreign_keys="ConnectionModel.to_edge_id",
        passive_deletes=True,
    )
    incoming_approaches: Mapped[list["IntersectionApproachModel"]] = relationship(
        "IntersectionApproachModel",
        back_populates="incoming_edge",
        foreign_keys="IntersectionApproachModel.incoming_edge_id",
        passive_deletes=True,
    )
    movements_from_edge: Mapped[list["MovementModel"]] = relationship(
        "MovementModel",
        back_populates="from_edge",
        foreign_keys="MovementModel.from_edge_id",
        passive_deletes=True,
    )
    movements_to_edge: Mapped[list["MovementModel"]] = relationship(
        "MovementModel",
        back_populates="to_edge",
        foreign_keys="MovementModel.to_edge_id",
        passive_deletes=True,
    )
    traffic_signs: Mapped[list["TrafficSignModel"]] = relationship(
        "TrafficSignModel",
        back_populates="edge",
        foreign_keys="TrafficSignModel.edge_id",
        passive_deletes=True,
    )
