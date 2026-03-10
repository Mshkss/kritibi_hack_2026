from sqlalchemy import ForeignKey, String, Float, Integer
from sqlalchemy.orm import mapped_column, Mapped

from backend.app.db.base import Base


class TrafficSignModel(Base):
    __tablename__ = "traffic_signs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id"),
        nullable=False
    )

    intersection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("intersections.id"),
        nullable=True
    )

    edge_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("edges.id"),
        nullable=False
    )

    sign_type: Mapped[str] = mapped_column(String, nullable=False)

    position_offset: Mapped[float] = mapped_column(Float, nullable=False)

    applies_to_lane_index: Mapped[int] = mapped_column(Integer, nullable=True)
