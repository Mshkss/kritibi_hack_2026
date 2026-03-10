"""SQLAlchemy model placeholder for RoadType."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RoadTypeModel(Base):
    __tablename__ = "road_types"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
