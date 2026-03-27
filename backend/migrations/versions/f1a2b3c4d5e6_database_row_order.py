"""Add order column to database_rows for manual row ordering

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-03-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'database_rows' not in inspector.get_table_names():
        return
    row_cols = [c['name'] for c in inspector.get_columns('database_rows')]
    if 'order' not in row_cols:
        op.add_column(
            'database_rows',
            sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'database_rows' not in inspector.get_table_names():
        return
    row_cols = [c['name'] for c in inspector.get_columns('database_rows')]
    if 'order' in row_cols:
        op.drop_column('database_rows', 'order')
