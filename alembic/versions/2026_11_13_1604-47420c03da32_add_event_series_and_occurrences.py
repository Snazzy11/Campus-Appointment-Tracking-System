"""add event series and occurrences

Revision ID: 47420c03da32
Revises: 15c48f428823
Create Date: 2026-11-13 16:04:35.136163

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "47420c03da32"
down_revision: str | Sequence[str] | None = "15c48f428823"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "event_series",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column(
            "details",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("timezone", sa.String(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("duration_min", sa.Integer(), nullable=False),
        sa.Column("rrule", sa.Text(), nullable=True),
        sa.Column("generated_until", sa.Date(), nullable=True),
        sa.CheckConstraint(
            "duration_min > 0", name="ck_event_series_duration_positive"
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_event_series_owner_id"), "event_series", ["owner_id"], unique=False
    )
    op.create_table(
        "event_occurrences",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("series_id", sa.BigInteger(), nullable=False),
        sa.Column("original_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(), server_default="scheduled", nullable=False),
        sa.Column("title_override", sa.Text(), nullable=True),
        sa.Column("location_override", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "status IN ('scheduled', 'cancelled')",
            name="ck_event_occurrences_status",
        ),
        sa.ForeignKeyConstraint(["series_id"], ["event_series.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "series_id", "original_start", name="uq_event_occurrences_series_original"
        ),
    )
    op.create_index(
        "ix_event_occurrences_start_at", "event_occurrences", ["start_at"], unique=False
    )
    op.create_index(
        "ix_event_occurrences_series_id_start_at",
        "event_occurrences",
        ["series_id", "start_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        "ix_event_occurrences_series_id_start_at", table_name="event_occurrences"
    )
    op.drop_index("ix_event_occurrences_start_at", table_name="event_occurrences")
    op.drop_table("event_occurrences")
    op.drop_index(op.f("ix_event_series_owner_id"), table_name="event_series")
    op.drop_table("event_series")
