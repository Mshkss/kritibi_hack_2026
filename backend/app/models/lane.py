"""SQLAlchemy model placeholder for Lane."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LaneModel(Base):
    __tablename__ = "lanes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
