"""Named groups, multiple owners, and persistent system messages."""
from alembic import op
import sqlalchemy as sa

revision = "c7a3f10d942b"
down_revision = "b63d129fe407"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("conversations", sa.Column("name", sa.String(80), nullable=True))
    op.add_column("messages", sa.Column("kind", sa.String(16), nullable=False, server_default="user"))
    op.create_index("ix_messages_conversation_history", "messages", ["conversation_id", "id"])
    op.create_table("conversation_owners",
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("promoted_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("conversation_id", "user_id"),
        sa.ForeignKeyConstraint(["conversation_id", "user_id"], ["conversation_members.conversation_id", "conversation_members.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["promoted_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )


def downgrade():
    # Refuse to erase roles/system-message meaning while groups still exist.
    connection = op.get_bind()
    if connection.execute(sa.text("SELECT count(*) FROM conversations WHERE type = 'group'")).scalar_one():
        raise RuntimeError("Group chats exist; preserve their data before downgrading")
    op.drop_table("conversation_owners")
    op.drop_index("ix_messages_conversation_history", table_name="messages")
    op.drop_column("messages", "kind")
    op.drop_column("conversations", "name")
