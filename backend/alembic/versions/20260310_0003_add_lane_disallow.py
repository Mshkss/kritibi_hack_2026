"""Add disallow column to lanes.

Revision ID: 20260310_0003
Revises: 20260310_0002
Create Date: 2026-03-10 22:25:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260310_0003"
down_revision: Union[str, Sequence[str], None] = "20260310_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lanes", sa.Column("disallow", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("lanes", "disallow")
