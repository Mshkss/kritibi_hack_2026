"""SQLAlchemy model placeholder for Phase."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PhaseModel(Base):
    __tablename__ = "phases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
