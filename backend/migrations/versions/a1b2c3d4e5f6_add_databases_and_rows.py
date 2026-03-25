"""Add databases and database_rows (structured table views)

Revision ID: a1b2c3d4e5f6
Revises: ba31f75b174e
Create Date: 2025-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'ba31f75b174e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = sa.inspect(bind).get_table_names()

    if 'databases' not in existing:
        op.create_table(
            'databases',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('title', sa.String(255), nullable=False, server_default='Untitled database'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )

    if 'database_rows' not in existing:
        op.create_table(
            'database_rows',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('database_id', sa.String(36), sa.ForeignKey('databases.id', ondelete='CASCADE'), nullable=False),
            sa.Column('properties', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table('database_rows')
    op.drop_table('databases')
