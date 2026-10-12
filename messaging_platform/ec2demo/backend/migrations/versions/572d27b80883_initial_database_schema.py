"""initial database schema

Revision ID: 572d27b80883
Revises: 
Create Date: 2026-10-08 20:41:44.879192

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '572d27b80883'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "cognito_sub",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "email",
            sa.String(length=320),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_users_cognito_sub",
        "users",
        ["cognito_sub"],
        unique=True,
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "sender",
            sa.String(length=320),
            nullable=False,
        ),
        sa.Column(
            "text",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_messages_user_id",
        "messages",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_messages_user_id",
        table_name="messages",
    )
    op.drop_table("messages")

    op.drop_index(
        "ix_users_cognito_sub",
        table_name="users",
    )
    op.drop_table("users")
