from sqlalchemy import String, ForeignKey, Integer, Float
from sqlalchemy.orm import mapped_column, Mapped

from backend.app.db.base import Base


class BusStopModel(Base):
    __tablename__ = "bus_stops"

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

    name: Mapped[str] = mapped_column(String, nullable=True)

    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
