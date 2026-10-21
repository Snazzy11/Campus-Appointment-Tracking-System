"""Chat schedule snapshots, availability consent, and owned message changes."""
from alembic import op
import sqlalchemy as sa
revision = 'a1e7d54b986f'
down_revision = 'f0d6c43a875e'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('messages', sa.Column('attachment', sa.JSON(), nullable=True))
    op.add_column('messages', sa.Column('version', sa.Integer(), server_default='1', nullable=False))
    op.add_column('messages', sa.Column('edited', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_table('chat_participation', sa.Column('message_id', sa.Integer(), sa.ForeignKey('messages.id', ondelete='CASCADE'), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True), sa.Column('consent_version', sa.Integer(), nullable=False))


def downgrade():
    op.drop_table('chat_participation')
    for column in ('edited', 'version', 'attachment'):
        op.drop_column('messages', column)
