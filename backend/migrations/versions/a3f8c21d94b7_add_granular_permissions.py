"""add granular permissions (managed_team_ids, extra_employee_ids)

Revision ID: a3f8c21d94b7
Revises: e0ed5ba84905
Create Date: 2026-09-08 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3f8c21d94b7'
down_revision: Union[str, None] = 'e0ed5ba84905'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('managed_team_ids', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('extra_employee_ids', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('extra_employee_ids')
        batch_op.drop_column('managed_team_ids')
