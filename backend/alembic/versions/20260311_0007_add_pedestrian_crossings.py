"""Add pedestrian_crossings table.

Revision ID: 20260311_0007
Revises: 20260311_0006
Create Date: 2026-03-11 03:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260311_0007"
down_revision: Union[str, Sequence[str], None] = "20260311_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pedestrian_crossings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("intersection_id", sa.String(length=36), nullable=False),
        sa.Column("approach_id", sa.String(length=36), nullable=True),
        sa.Column("side_key", sa.String(length=255), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("crossing_kind", sa.String(length=32), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "crossing_kind in ('zebra', 'signalized', 'uncontrolled') or crossing_kind is null",
            name="ck_ped_crossings_kind",
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["intersection_id"], ["intersections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approach_id"], ["intersection_approaches.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("intersection_id", "side_key", name="uq_ped_crossings_intersection_side"),
    )
    op.create_index("ix_ped_crossings_project_id", "pedestrian_crossings", ["project_id"])
    op.create_index("ix_ped_crossings_intersection_id", "pedestrian_crossings", ["intersection_id"])
    op.create_index("ix_ped_crossings_approach_id", "pedestrian_crossings", ["approach_id"])
    op.create_index(
        "ix_ped_crossings_project_intersection",
        "pedestrian_crossings",
        ["project_id", "intersection_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_ped_crossings_project_intersection", table_name="pedestrian_crossings")
    op.drop_index("ix_ped_crossings_approach_id", table_name="pedestrian_crossings")
    op.drop_index("ix_ped_crossings_intersection_id", table_name="pedestrian_crossings")
    op.drop_index("ix_ped_crossings_project_id", table_name="pedestrian_crossings")
    op.drop_table("pedestrian_crossings")
