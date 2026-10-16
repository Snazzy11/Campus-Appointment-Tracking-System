"""Editable user profiles; existing identities and messages remain unchanged."""
from alembic import op
import sqlalchemy as sa

revision = "d8b4a21e653c"
down_revision = "c7a3f10d942b"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("username", sa.String(30), nullable=True))
    op.add_column("users", sa.Column("display_name", sa.String(80), nullable=True))
    op.add_column("users", sa.Column("bio", sa.String(300), nullable=False, server_default=""))
    op.add_column("users", sa.Column("avatar_key", sa.String(80), nullable=True))
    op.add_column("users", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index("uq_users_username_lower", "users", [sa.text("lower(username)")], unique=True)


def downgrade():
    if op.get_bind().execute(sa.text("SELECT count(*) FROM users WHERE username IS NOT NULL OR display_name IS NOT NULL OR bio != '' OR avatar_key IS NOT NULL")).scalar_one():
        raise RuntimeError("Profiles contain data; preserve it before downgrading")
    op.drop_index("uq_users_username_lower", table_name="users")
    for name in ("updated_at", "avatar_key", "bio", "display_name", "username"):
        op.drop_column("users", name)
