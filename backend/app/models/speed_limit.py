from sqlalchemy import ForeignKey, String, Integer, Float
from sqlalchemy.orm import mapped_column, Mapped

from backend.app.db.base import Base


class SpeedLimitModel(Base):
    __tablename__ = "speed_limits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id"),
        nullable=False
    )

    edge_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("edges.id"),
        nullable=False
    )

    lane_index: Mapped[int] = mapped_column(Integer, nullable=True)

    start_offset: Mapped[float] = mapped_column(Float, nullable=False)

    end_offset: Mapped[float] = mapped_column(Float, nullable=False)

    speed: Mapped[float] = mapped_column(Float, nullable=False)

    source: Mapped[str] = mapped_column(String, nullable=False)

    name: Mapped[str] = mapped_column(String, nullable=True)
