"""add user tracking fields and user_activity table

Revision ID: a1b2c3d4e5f6
Revises: 6e11122fec94
Create Date: 2026-03-17
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '6e11122fec94'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('last_seen_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('login_count', sa.Integer(), nullable=False, server_default='0'))

    op.create_table(
        'user_activity',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('action_type', sa.String(), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False, server_default='1'),
        sa.UniqueConstraint('user_id', 'date', 'action_type', name='uq_user_activity'),
    )
    op.create_index('ix_user_activity_user_id', 'user_activity', ['user_id'])


def downgrade():
    op.drop_index('ix_user_activity_user_id', table_name='user_activity')
    op.drop_table('user_activity')
    op.drop_column('users', 'login_count')
    op.drop_column('users', 'last_seen_at')
    op.drop_column('users', 'last_login_at')
