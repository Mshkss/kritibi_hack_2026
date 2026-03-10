"""SQLAlchemy model placeholder for Movement."""

from sqlalchemy import String, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base


class MovementModel(Base):
    __tablename__ = "movements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    intersection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("intersections.id"),
        nullable=False
    )

    connection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("connections.id"),
        nullable=False
    )

    turn_type: Mapped[str] = mapped_column(String, nullable=False)

    is_allowed: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("intersection_id", "connection_id"),
    )
