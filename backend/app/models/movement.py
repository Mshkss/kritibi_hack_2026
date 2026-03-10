"""SQLAlchemy model placeholder for Movement."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MovementModel(Base):
    __tablename__ = "movements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
