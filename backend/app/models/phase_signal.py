from sqlalchemy import String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import mapped_column, Mapped

from backend.app.db.base import Base


class PhaseSignalModel(Base):
    __tablename__ = "phase_signals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    phase_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("phases.id"),
        nullable=False
    )

    signal_group_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("signal_groups.id"),
        nullable=False
    )

    state: Mapped[str] = mapped_column(String, nullable=False)

    __table_args__ = (
        UniqueConstraint("phase_id", "signal_group_id"),
    )
