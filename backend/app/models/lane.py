"""SQLAlchemy model for Lane."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LaneModel(Base):
    """Lane data inside directed edge."""

    __tablename__ = "lanes"
    __table_args__ = (
        UniqueConstraint("edge_id", "index", name="uq_lanes_edge_index"),
        CheckConstraint('"index" >= 0', name="ck_lanes_index_non_negative"),
        Index("ix_lanes_edge_id", "edge_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    edge_id: Mapped[str] = mapped_column(ForeignKey("edges.id", ondelete="CASCADE"), nullable=False)
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    allow: Mapped[str | None] = mapped_column(Text, nullable=True)
    disallow: Mapped[str | None] = mapped_column(Text, nullable=True)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    width: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    edge: Mapped["EdgeModel"] = relationship("EdgeModel", back_populates="lanes")
