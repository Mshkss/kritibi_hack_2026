"""SQLAlchemy model placeholder for Intersection."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IntersectionModel(Base):
    __tablename__ = "intersections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
