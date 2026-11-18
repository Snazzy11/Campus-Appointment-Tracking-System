"""changed rso char limits for some of the things

Revision ID: b64658d9b16e
Revises: 47420c03da32
Create Date: 2026-11-16 02:29:34.440634

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b64658d9b16e"
down_revision: str | Sequence[str] | None = "47420c03da32"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # user_schedule was never created by any migration (it was a leftover table
    # in a local dev database), so it must not be dropped here.
    op.alter_column(
        "rsos",
        "link",
        existing_type=sa.VARCHAR(length=50),
        type_=sa.String(length=150),
        existing_nullable=False,
    )
    op.alter_column(
        "rsos",
        "location",
        existing_type=sa.VARCHAR(length=100),
        type_=sa.String(length=255),
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "rsos",
        "location",
        existing_type=sa.String(length=255),
        type_=sa.VARCHAR(length=100),
        existing_nullable=False,
    )
    op.alter_column(
        "rsos",
        "link",
        existing_type=sa.String(length=150),
        type_=sa.VARCHAR(length=50),
        existing_nullable=False,
    )
