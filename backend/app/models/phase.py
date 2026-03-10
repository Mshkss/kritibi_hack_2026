"""SQLAlchemy model placeholder for Phase."""

from sqlalchemy import String, ForeignKey, UniqueConstraint, Integer
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base


class PhaseModel(Base):
    __tablename__ = "phases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    intersection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("intersections.id"),
        nullable=False
    )

    name: Mapped[str] = mapped_column(String, nullable=True)

    duration: Mapped[int] = mapped_column(Integer, nullable=False)

    min_duration: Mapped[int] = mapped_column(Integer, nullable=True)

    max_duration: Mapped[int] = mapped_column(Integer, nullable=True)

    order_index: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("intersection_id", "order_index"),
    )
