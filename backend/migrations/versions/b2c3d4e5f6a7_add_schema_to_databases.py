"""Add schema column to databases table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-17

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # JSON columns cannot have a server_default in MySQL, so we add it nullable
    # and backfill before setting NOT NULL — but since existing rows can be empty
    # we just leave it nullable and treat NULL as an empty schema in application code.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c['name'] for c in inspector.get_columns('databases')]
    if 'schema' not in columns:
        op.add_column(
            'databases',
            sa.Column('schema', sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column('databases', 'schema')
