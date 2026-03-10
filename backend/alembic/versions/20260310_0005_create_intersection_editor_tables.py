"""Create intersection editor tables: intersections, approaches, movements.

Revision ID: 20260310_0005
Revises: 20260310_0004
Create Date: 2026-03-11 00:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260310_0005"
down_revision: Union[str, Sequence[str], None] = "20260310_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "intersections",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("node_id", sa.String(length=36), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
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
        sa.CheckConstraint("kind in ('crossroad', 'roundabout')", name="ck_intersections_kind"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["node_id"], ["nodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("node_id", name="uq_intersections_node_id"),
    )
    op.create_index("ix_intersections_project_id", "intersections", ["project_id"])
    op.create_index("ix_intersections_node_id", "intersections", ["node_id"])

    op.create_table(
        "intersection_approaches",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("intersection_id", sa.String(length=36), nullable=False),
        sa.Column("incoming_edge_id", sa.String(length=36), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
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
        sa.CheckConstraint("order_index is null or order_index >= 0", name="ck_approaches_order_index_non_negative"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["intersection_id"], ["intersections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["incoming_edge_id"], ["edges.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("intersection_id", "incoming_edge_id", name="uq_approaches_intersection_incoming_edge"),
    )
    op.create_index("ix_approaches_project_id", "intersection_approaches", ["project_id"])
    op.create_index("ix_approaches_intersection_id", "intersection_approaches", ["intersection_id"])
    op.create_index("ix_approaches_incoming_edge_id", "intersection_approaches", ["incoming_edge_id"])

    op.create_table(
        "movements",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("intersection_id", sa.String(length=36), nullable=False),
        sa.Column("approach_id", sa.String(length=36), nullable=False),
        sa.Column("connection_id", sa.String(length=36), nullable=False),
        sa.Column("from_edge_id", sa.String(length=36), nullable=False),
        sa.Column("to_edge_id", sa.String(length=36), nullable=False),
        sa.Column("from_lane_index", sa.Integer(), nullable=False),
        sa.Column("to_lane_index", sa.Integer(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("movement_kind", sa.Text(), nullable=True),
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
        sa.CheckConstraint("from_lane_index >= 0", name="ck_movements_from_lane_non_negative"),
        sa.CheckConstraint("to_lane_index >= 0", name="ck_movements_to_lane_non_negative"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["intersection_id"], ["intersections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approach_id"], ["intersection_approaches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["connection_id"], ["connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_edge_id"], ["edges.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_edge_id"], ["edges.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("intersection_id", "connection_id", name="uq_movements_intersection_connection"),
    )
    op.create_index("ix_movements_project_id", "movements", ["project_id"])
    op.create_index("ix_movements_intersection_id", "movements", ["intersection_id"])
    op.create_index("ix_movements_approach_id", "movements", ["approach_id"])
    op.create_index("ix_movements_connection_id", "movements", ["connection_id"])


def downgrade() -> None:
    op.drop_index("ix_movements_connection_id", table_name="movements")
    op.drop_index("ix_movements_approach_id", table_name="movements")
    op.drop_index("ix_movements_intersection_id", table_name="movements")
    op.drop_index("ix_movements_project_id", table_name="movements")
    op.drop_table("movements")

    op.drop_index("ix_approaches_incoming_edge_id", table_name="intersection_approaches")
    op.drop_index("ix_approaches_intersection_id", table_name="intersection_approaches")
    op.drop_index("ix_approaches_project_id", table_name="intersection_approaches")
    op.drop_table("intersection_approaches")

    op.drop_index("ix_intersections_node_id", table_name="intersections")
    op.drop_index("ix_intersections_project_id", table_name="intersections")
    op.drop_table("intersections")
