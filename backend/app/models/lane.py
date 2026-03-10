"""SQLAlchemy model placeholder for Lane."""

from sqlalchemy import String, ForeignKey, Integer, Float, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base


class LaneModel(Base):
    __tablename__ = "lanes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    edge_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("edges.id"),
        nullable=False
    )

    lane_index: Mapped[int] = mapped_column(Integer, nullable=False)

    width: Mapped[float] = mapped_column(Float, nullable=False)

    speed: Mapped[float] = mapped_column(Float, nullable=True)

    allow: Mapped[dict] = mapped_column(JSON, nullable=True)
    disallow: Mapped[dict] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("edge_id", "lane_index"),
    )