"""Database rows as pages: leaf_id on rows, database_id + tags on leaves, view_type on databases

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-17

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    leaf_cols = [c['name'] for c in inspector.get_columns('leaves')]
    db_cols = [c['name'] for c in inspector.get_columns('databases')]
    row_cols = [c['name'] for c in inspector.get_columns('database_rows')]

    if 'tags' not in leaf_cols:
        op.add_column('leaves', sa.Column('tags', sa.JSON(), nullable=True))

    if 'database_id' not in leaf_cols:
        op.add_column(
            'leaves',
            sa.Column('database_id', sa.String(36),
                      sa.ForeignKey('databases.id', ondelete='SET NULL'),
                      nullable=True),
        )

    if 'view_type' not in db_cols:
        op.add_column(
            'databases',
            sa.Column('view_type', sa.String(20), nullable=False, server_default='table'),
        )

    if 'leaf_id' not in row_cols:
        op.add_column(
            'database_rows',
            sa.Column('leaf_id', sa.String(36),
                      sa.ForeignKey('leaves.id', ondelete='SET NULL'),
                      nullable=True),
        )


def downgrade() -> None:
    op.drop_column('database_rows', 'leaf_id')
    op.drop_column('databases', 'view_type')
    op.drop_column('leaves', 'database_id')
    op.drop_column('leaves', 'tags')
