"""SQLAlchemy model placeholder for Connection."""

from sqlalchemy import String, UniqueConstraint, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base


class ConnectionModel(Base):
    __tablename__ = "connections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id"),
        nullable=False
    )

    from_edge_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("edges.id"),
        nullable=False
    )

    to_edge_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("edges.id"),
        nullable=False
    )

    via_node_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nodes.id"),
        nullable=False
    )

    from_lane_index: Mapped[int] = mapped_column(Integer, nullable=False)

    to_lane_index: Mapped[int] = mapped_column(Integer, nullable=False)

    uncontrolled: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "from_edge_id",
            "to_edge_id",
            "from_lane_index",
            "to_lane_index"
        ),
    )