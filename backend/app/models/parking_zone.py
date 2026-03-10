from sqlalchemy import String, Float, Integer, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped

from backend.app.db.base import Base


class ParkingZoneModel(Base):
    __tablename__ = "parking_zones"

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

    side: Mapped[str] = mapped_column(String, nullable=False)

    start_offset: Mapped[float] = mapped_column(Float, nullable=False)

    end_offset: Mapped[float] = mapped_column(Float, nullable=False)

    capacity: Mapped[int] = mapped_column(Integer, nullable=False)

    parking_type: Mapped[str] = mapped_column(String, nullable=False)
