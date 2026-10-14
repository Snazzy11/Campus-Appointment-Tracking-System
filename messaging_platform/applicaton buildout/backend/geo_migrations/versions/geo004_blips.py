"""Moderated geographic reports, roles and stable path-segment associations."""

from alembic import op
from sqlalchemy import text

revision = "geo004"
down_revision = "geo003"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""CREATE TABLE geo.blip_categories (
      slug text PRIMARY KEY, label text NOT NULL, enabled boolean NOT NULL DEFAULT true)""")
    for slug, label in [
        ("construction", "Construction"),
        ("closed_sidewalk", "Closed sidewalk"),
        ("road_closure", "Road closure"),
        ("ice", "Icy walkway"),
        ("flooding", "Flooding"),
        ("accessibility", "Accessibility obstruction"),
        ("event", "Campus event"),
        ("hazard", "General hazard"),
        ("other", "Other"),
    ]:
        op.get_bind().execute(
            text("INSERT INTO geo.blip_categories VALUES(:slug,:label,true)"),
            {"slug": slug, "label": label},
        )
    op.execute("""CREATE TABLE geo.blip_roles (
      user_id bigint PRIMARY KEY CHECK(user_id>0),
      role text NOT NULL CHECK(role IN ('moderator','admin')))""")
    op.execute("""CREATE TABLE geo.blips (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      author_id bigint NOT NULL CHECK(author_id>0),
      category text NOT NULL REFERENCES geo.blip_categories(slug),
      description text NOT NULL CHECK(length(description) BETWEEN 10 AND 1000),
      geom geometry(Geometry,4326) NOT NULL,
      severity text NOT NULL CHECK(severity IN ('low','medium','high')),
      status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','active','rejected','resolved')),
      verified boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      CHECK(expires_at>created_at AND expires_at<=created_at+interval '30 days'),
      CHECK(ST_IsValid(geom) AND NOT ST_IsEmpty(geom) AND ST_NDims(geom)=2
        AND GeometryType(geom) IN ('POINT','LINESTRING','POLYGON')
        AND ST_CoveredBy(geom,ST_MakeEnvelope(-84.80,43.56,-84.74,43.62,4326))))""")
    op.execute("CREATE INDEX blips_geom ON geo.blips USING gist(geom)")
    op.execute("CREATE INDEX blips_author_created ON geo.blips(author_id,created_at)")
    op.execute("CREATE INDEX blips_status_expiry ON geo.blips(status,expires_at)")
    op.execute("""CREATE TABLE geo.blip_edges (
      blip_id bigint NOT NULL REFERENCES geo.blips(id),
      feature_id bigint NOT NULL REFERENCES geo.features(id),
      source bigint NOT NULL, target bigint NOT NULL,
      PRIMARY KEY(blip_id,feature_id,source,target))""")
    op.execute(
        "CREATE INDEX blip_edges_path ON geo.blip_edges(feature_id,source,target)"
    )
    op.execute("""CREATE TABLE geo.blip_audit (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      blip_id bigint REFERENCES geo.blips(id), actor_id bigint NOT NULL,
      action text NOT NULL, note text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now())""")


def downgrade():
    if (
        op.get_bind()
        .execute(
            text(
                "SELECT (SELECT count(*) FROM geo.blips)+(SELECT count(*) FROM geo.blip_roles)+(SELECT count(*) FROM geo.blip_audit)"
            )
        )
        .scalar()
    ):
        raise RuntimeError(
            "Reports or role grants exist; restore a backup instead of destructive downgrade"
        )
    for table in ("blip_audit", "blip_edges", "blips", "blip_roles", "blip_categories"):
        op.execute(f"DROP TABLE geo.{table}")
