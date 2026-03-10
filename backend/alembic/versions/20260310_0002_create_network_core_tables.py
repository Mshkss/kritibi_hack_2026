"""Create network core tables: nodes, road_types, edges, lanes.

Revision ID: 20260310_0002
Revises: 20260310_0001
Create Date: 2026-03-10 21:35:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260310_0002"
down_revision: Union[str, Sequence[str], None] = "20260310_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "nodes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("code", sa.String(length=128), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("type", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "code", name="uq_nodes_project_code"),
    )
    op.create_index("ix_nodes_project_id", "nodes", ["project_id"])

    op.create_table(
        "road_types",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("code", sa.String(length=128), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("num_lanes", sa.Integer(), nullable=True),
        sa.Column("speed", sa.Float(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=True),
        sa.Column("width", sa.Float(), nullable=True),
        sa.Column("sidewalk_width", sa.Float(), nullable=True),
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
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "code", name="uq_road_types_project_code"),
    )
    op.create_index("ix_road_types_project_id", "road_types", ["project_id"])

    op.create_table(
        "edges",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("code", sa.String(length=128), nullable=False),
        sa.Column("from_node_id", sa.String(length=36), nullable=False),
        sa.Column("to_node_id", sa.String(length=36), nullable=False),
        sa.Column("road_type_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("speed", sa.Float(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=True),
        sa.Column("length", sa.Float(), nullable=True),
        sa.Column("width", sa.Float(), nullable=True),
        sa.Column("sidewalk_width", sa.Float(), nullable=True),
        sa.Column("shape", sa.JSON(), nullable=False),
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
        sa.CheckConstraint("from_node_id <> to_node_id", name="ck_edges_from_to_different"),
        sa.ForeignKeyConstraint(["from_node_id"], ["nodes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["road_type_id"], ["road_types.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["to_node_id"], ["nodes.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "code", name="uq_edges_project_code"),
    )
    op.create_index("ix_edges_project_id", "edges", ["project_id"])
    op.create_index("ix_edges_from_node_id", "edges", ["from_node_id"])
    op.create_index("ix_edges_to_node_id", "edges", ["to_node_id"])
    op.create_index("ix_edges_road_type_id", "edges", ["road_type_id"])

    op.create_table(
        "lanes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("edge_id", sa.String(length=36), nullable=False),
        sa.Column("index", sa.Integer(), nullable=False),
        sa.Column("allow", sa.Text(), nullable=True),
        sa.Column("speed", sa.Float(), nullable=True),
        sa.Column("width", sa.Float(), nullable=True),
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
        sa.CheckConstraint('"index" >= 0', name="ck_lanes_index_non_negative"),
        sa.ForeignKeyConstraint(["edge_id"], ["edges.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("edge_id", "index", name="uq_lanes_edge_index"),
    )
    op.create_index("ix_lanes_edge_id", "lanes", ["edge_id"])


def downgrade() -> None:
    op.drop_index("ix_lanes_edge_id", table_name="lanes")
    op.drop_table("lanes")

    op.drop_index("ix_edges_road_type_id", table_name="edges")
    op.drop_index("ix_edges_to_node_id", table_name="edges")
    op.drop_index("ix_edges_from_node_id", table_name="edges")
    op.drop_index("ix_edges_project_id", table_name="edges")
    op.drop_table("edges")

    op.drop_index("ix_road_types_project_id", table_name="road_types")
    op.drop_table("road_types")

    op.drop_index("ix_nodes_project_id", table_name="nodes")
    op.drop_table("nodes")
