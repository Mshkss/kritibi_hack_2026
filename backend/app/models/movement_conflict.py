from sqlalchemy import String, ForeignKey, Boolean
from sqlalchemy.orm import mapped_column, Mapped

from backend.app.db.base import Base


class MovementConflictModel(Base):
    __tablename__ = "movement_conflicts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    intersection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("intersections.id"),
        nullable=False
    )

    movement_a_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("movements.id"),
        nullable=False
    )

    movement_b_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("movements.id"),
        nullable=False
    )

    conflict_type: Mapped[str] = mapped_column(String, nullable=False)

    is_conflict: Mapped[bool] = mapped_column(Boolean, default=True)