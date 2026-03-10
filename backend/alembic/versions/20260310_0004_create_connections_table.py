"""Create connections table for node traversal layer.

Revision ID: 20260310_0004
Revises: 20260310_0003
Create Date: 2026-03-10 23:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260310_0004"
down_revision: Union[str, Sequence[str], None] = "20260310_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "connections",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("via_node_id", sa.String(length=36), nullable=False),
        sa.Column("from_edge_id", sa.String(length=36), nullable=False),
        sa.Column("to_edge_id", sa.String(length=36), nullable=False),
        sa.Column("from_lane_index", sa.Integer(), nullable=False),
        sa.Column("to_lane_index", sa.Integer(), nullable=False),
        sa.Column(
            "uncontrolled",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
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
        sa.CheckConstraint("from_lane_index >= 0", name="ck_connections_from_lane_non_negative"),
        sa.CheckConstraint("to_lane_index >= 0", name="ck_connections_to_lane_non_negative"),
        sa.CheckConstraint("from_edge_id <> to_edge_id", name="ck_connections_from_to_edge_different"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["via_node_id"], ["nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_edge_id"], ["edges.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_edge_id"], ["edges.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "project_id",
            "from_edge_id",
            "to_edge_id",
            "from_lane_index",
            "to_lane_index",
            name="uq_connections_project_from_to_lanes",
        ),
    )

    op.create_index("ix_connections_project_id", "connections", ["project_id"])
    op.create_index("ix_connections_via_node_id", "connections", ["via_node_id"])
    op.create_index("ix_connections_from_edge_id", "connections", ["from_edge_id"])
    op.create_index("ix_connections_to_edge_id", "connections", ["to_edge_id"])
    op.create_index("ix_connections_project_via_node", "connections", ["project_id", "via_node_id"])


def downgrade() -> None:
    op.drop_index("ix_connections_project_via_node", table_name="connections")
    op.drop_index("ix_connections_to_edge_id", table_name="connections")
    op.drop_index("ix_connections_from_edge_id", table_name="connections")
    op.drop_index("ix_connections_via_node_id", table_name="connections")
    op.drop_index("ix_connections_project_id", table_name="connections")
    op.drop_table("connections")
