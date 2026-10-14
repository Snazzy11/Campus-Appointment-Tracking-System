"""Private term-based class schedules."""
from alembic import op
import sqlalchemy as sa
revision = 'e9c5b32f764d'
down_revision = 'd8b4a21e653c'
branch_labels = depends_on = None


def upgrade():
    op.create_table('schedule_terms',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('season', sa.String(10), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.UniqueConstraint('user_id', 'season', 'year'))
    op.create_index('ix_schedule_terms_user_id', 'schedule_terms', ['user_id'])
    op.create_table('schedule_courses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('term_id', sa.Integer(), sa.ForeignKey('schedule_terms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('section', sa.String(40), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.UniqueConstraint('term_id', 'section'))
    op.create_index('ix_schedule_courses_term_id', 'schedule_courses', ['term_id'])


def downgrade():
    if op.get_bind().execute(sa.text('SELECT count(*) FROM schedule_courses')).scalar_one():
        raise RuntimeError('Schedules contain data; back them up before downgrading.')
    op.drop_table('schedule_courses')
    op.drop_table('schedule_terms')
