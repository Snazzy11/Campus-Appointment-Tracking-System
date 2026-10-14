"""Individual student calendar events."""
from alembic import op
import sqlalchemy as sa
revision = 'f0d6c43a875e'
down_revision = 'e9c5b32f764d'
branch_labels = depends_on = None

def upgrade():
    op.create_table('schedule_events', sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('term_id', sa.Integer(), sa.ForeignKey('schedule_terms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False), sa.Column('data', sa.JSON(), nullable=False))
    op.create_index('ix_schedule_events_term_id', 'schedule_events', ['term_id'])

def downgrade():
    if op.get_bind().execute(sa.text('SELECT count(*) FROM schedule_events')).scalar_one():
        raise RuntimeError('Calendar events contain data; back them up before downgrading.')
    op.drop_table('schedule_events')
