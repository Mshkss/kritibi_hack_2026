"""SQLAlchemy model placeholder for Intersection."""

from sqlalchemy import String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base


class IntersectionModel(Base):
    __tablename__ = "intersections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id"),
        nullable=False
    )

    node_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nodes.id"),
        nullable=False
    )

    kind: Mapped[str] = mapped_column(String, nullable=False)

    control_type: Mapped[str] = mapped_column(String, nullable=False)

    name: Mapped[str] = mapped_column(String, nullable=True)

    __table_args__ = (
        UniqueConstraint("project_id", "node_id"),
    )