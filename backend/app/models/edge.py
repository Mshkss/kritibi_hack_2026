"""SQLAlchemy model placeholder for Edge."""

from sqlalchemy import String, ForeignKey, Float, Integer, Boolean, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base

class EdgeModel(Base):
    __tablename__ = "edges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id"),
        nullable=False
    )

    code: Mapped[str] = mapped_column(String, nullable=False)

    from_node_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nodes.id"),
        nullable=False
    )

    to_node_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nodes.id"),
        nullable=False
    )

    road_type_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("road_types.id"),
        nullable=True
    )

    name: Mapped[str] = mapped_column(String, nullable=True)

    speed: Mapped[float] = mapped_column(Float, nullable=True)

    priority: Mapped[int] = mapped_column(Integer, nullable=True)

    length: Mapped[float] = mapped_column(Float, nullable=False)

    surface: Mapped[str] = mapped_column(String, nullable=True)

    shape: Mapped[dict] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("project_id", "code"),
    )
