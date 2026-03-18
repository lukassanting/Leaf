"""add icon, properties columns to leaves and page_links table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    # Add icon and properties columns to leaves
    cols = [c['name'] for c in inspector.get_columns('leaves')]
    if 'icon' not in cols:
        op.add_column('leaves', sa.Column('icon', sa.JSON(), nullable=True))
    if 'properties' not in cols:
        op.add_column('leaves', sa.Column('properties', sa.JSON(), nullable=True))

    # Create page_links table
    tables = inspector.get_table_names()
    if 'page_links' not in tables:
        op.create_table(
            'page_links',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('source_leaf_id', sa.String(36), sa.ForeignKey('leaves.id', ondelete='CASCADE'), nullable=False),
            sa.Column('target_leaf_id', sa.String(36), sa.ForeignKey('leaves.id', ondelete='CASCADE'), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_page_links_source_leaf_id', 'page_links', ['source_leaf_id'])
        op.create_index('ix_page_links_target_leaf_id', 'page_links', ['target_leaf_id'])


def downgrade():
    op.drop_table('page_links')
    op.drop_column('leaves', 'properties')
    op.drop_column('leaves', 'icon')
