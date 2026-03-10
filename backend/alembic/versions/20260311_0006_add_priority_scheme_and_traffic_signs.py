"""Add approach priority fields and traffic_signs table.

Revision ID: 20260311_0006
Revises: 20260310_0005
Create Date: 2026-03-11 01:35:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260311_0006"
down_revision: Union[str, Sequence[str], None] = "20260310_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("intersection_approaches", sa.Column("role", sa.String(length=32), nullable=True))
    op.add_column("intersection_approaches", sa.Column("priority_rank", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_approaches_role",
        "intersection_approaches",
        "role in ('main', 'secondary') or role is null",
    )
    op.create_check_constraint(
        "ck_approaches_priority_rank_non_negative",
        "intersection_approaches",
        "priority_rank is null or priority_rank >= 0",
    )

    op.create_table(
        "traffic_signs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("intersection_id", sa.String(length=36), nullable=True),
        sa.Column("approach_id", sa.String(length=36), nullable=True),
        sa.Column("node_id", sa.String(length=36), nullable=True),
        sa.Column("edge_id", sa.String(length=36), nullable=True),
        sa.Column("sign_type", sa.String(length=32), nullable=False),
        sa.Column("generated", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
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
            "intersection_id is not null or node_id is not null or edge_id is not null",
            name="ck_traffic_signs_scope_anchor",
        ),
        sa.CheckConstraint("sign_type in ('main_road', 'yield', 'stop')", name="ck_traffic_signs_sign_type"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["intersection_id"], ["intersections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approach_id"], ["intersection_approaches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["node_id"], ["nodes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["edge_id"], ["edges.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "project_id",
            "intersection_id",
            "approach_id",
            "sign_type",
            "generated",
            name="uq_traffic_signs_scope_generated",
        ),
    )
    op.create_index("ix_traffic_signs_project_id", "traffic_signs", ["project_id"])
    op.create_index("ix_traffic_signs_intersection_id", "traffic_signs", ["intersection_id"])
    op.create_index("ix_traffic_signs_approach_id", "traffic_signs", ["approach_id"])
    op.create_index("ix_traffic_signs_node_id", "traffic_signs", ["node_id"])
    op.create_index("ix_traffic_signs_edge_id", "traffic_signs", ["edge_id"])


def downgrade() -> None:
    op.drop_index("ix_traffic_signs_edge_id", table_name="traffic_signs")
    op.drop_index("ix_traffic_signs_node_id", table_name="traffic_signs")
    op.drop_index("ix_traffic_signs_approach_id", table_name="traffic_signs")
    op.drop_index("ix_traffic_signs_intersection_id", table_name="traffic_signs")
    op.drop_index("ix_traffic_signs_project_id", table_name="traffic_signs")
    op.drop_table("traffic_signs")

    op.drop_constraint("ck_approaches_priority_rank_non_negative", "intersection_approaches", type_="check")
    op.drop_constraint("ck_approaches_role", "intersection_approaches", type_="check")
    op.drop_column("intersection_approaches", "priority_rank")
    op.drop_column("intersection_approaches", "role")
