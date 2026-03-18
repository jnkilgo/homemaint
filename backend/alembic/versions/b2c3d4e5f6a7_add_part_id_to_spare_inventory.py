"""add part_id to spare_inventory

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Add without FK constraint — SQLite does not support ALTER TABLE ADD CONSTRAINT
    op.add_column('spare_inventory', sa.Column('part_id', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('spare_inventory', 'part_id')
