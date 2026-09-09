"""team_kpi_configs.normalize_over_entered flag

Revision ID: c7d2e9f41a05
Revises: a3f8c21d94b7
Create Date: 2026-09-09 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d2e9f41a05'
down_revision: Union[str, None] = 'a3f8c21d94b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('team_kpi_configs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('normalize_over_entered', sa.Boolean(),
                                      nullable=True, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table('team_kpi_configs', schema=None) as batch_op:
        batch_op.drop_column('normalize_over_entered')
