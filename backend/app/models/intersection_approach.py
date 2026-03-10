from sqlalchemy import String, ForeignKey, UniqueConstraint, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base


class IntersectionApproachModel(Base):
    __tablename__ = "intersection_approaches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    intersection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("intersections.id"),
        nullable=False
    )

    incoming_edge_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("edges.id"),
        nullable=False
    )

    role: Mapped[str] = mapped_column(String, nullable=True)

    has_crosswalk: Mapped[bool] = mapped_column(Boolean, default=False)

    priority_rank: Mapped[int] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("intersection_id", "incoming_edge_id"),
    )