"""add parent_leaf_id to databases

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('databases')]
    if 'parent_leaf_id' not in cols:
        op.add_column(
            'databases',
            sa.Column(
                'parent_leaf_id',
                sa.String(36),
                sa.ForeignKey('leaves.id', ondelete='SET NULL'),
                nullable=True,
            ),
        )


def downgrade():
    op.drop_column('databases', 'parent_leaf_id')
