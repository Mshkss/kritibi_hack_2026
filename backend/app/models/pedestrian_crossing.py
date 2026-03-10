from sqlalchemy import ForeignKey, String, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base


class PedestrianCrossingModel(Base):
    __tablename__ = "pedestrian_crossings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id"),
        nullable=False
    )

    placement_type: Mapped[str] = mapped_column(String, nullable=False)

    intersection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("intersections.id"),
        nullable=True
    )

    approach_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("intersection_approaches.id"),
        nullable=True
    )

    edge_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("edges.id"),
        nullable=True
    )

    offset: Mapped[float] = mapped_column(Float, nullable=True)

    width: Mapped[float] = mapped_column(Float, nullable=False)

    has_signal: Mapped[bool] = mapped_column(Boolean, default=False)

    name: Mapped[str] = mapped_column(String, nullable=True)
