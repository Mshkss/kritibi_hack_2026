"""SQLAlchemy model placeholder for RoadType."""

from sqlalchemy import String, Integer, Float, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base


class RoadTypeModel(Base):
    __tablename__ = "road_types"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id"),
        nullable=False
    )

    code: Mapped[str] = mapped_column(String, nullable=False)

    name: Mapped[str] = mapped_column(String, nullable=True)

    default_speed: Mapped[float] = mapped_column(Float, nullable=False)

    default_lanes: Mapped[int] = mapped_column(Integer, nullable=False)

    default_lane_width: Mapped[float] = mapped_column(Float, nullable=False)

    default_surface: Mapped[str] = mapped_column(String, nullable=True)

    default_allow: Mapped[dict] = mapped_column(JSON, nullable=True)

    default_disallow: Mapped[dict] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("project_id", "code"),
    )