from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped

from backend.app.db.base import Base


class SignalGroupModel(Base):
    __tablename__ = "signal_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    intersection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("intersections.id"),
        nullable=False
    )

    group_type: Mapped[str] = mapped_column(String, nullable=False)

    movement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("movements.id"),
        nullable=True
    )

    crossing_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pedestrian_crossings.id"),
        nullable=True
    )

    name: Mapped[str] = mapped_column(String, nullable=True)
