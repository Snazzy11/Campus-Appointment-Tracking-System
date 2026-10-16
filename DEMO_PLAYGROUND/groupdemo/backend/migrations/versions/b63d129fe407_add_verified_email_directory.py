"""Record verified emails and index directory prefix searches.

Revision ID: b63d129fe407
Revises: 441d5178d7b4
"""
from alembic import op
import sqlalchemy as sa

revision = "b63d129fe407"
down_revision = "441d5178d7b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Do not assume previously stored addresses were verified; refresh at login.
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute("CREATE INDEX ix_users_email_prefix ON users (lower(email) text_pattern_ops) WHERE email_verified IS TRUE")


def downgrade() -> None:
    op.drop_index("ix_users_email_prefix", table_name="users")
    op.drop_column("users", "email_verified")
