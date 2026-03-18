"""add_is_loanable_to_assets

Revision ID: 6e11122fec94
Revises: bf1424a4c39b
Create Date: 2026-03-17 16:59:19.491357

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e11122fec94'
down_revision: Union[str, Sequence[str], None] = 'bf1424a4c39b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('assets', sa.Column('is_loanable', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('assets', 'is_loanable')
