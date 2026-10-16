"""Independent, rebuildable routing graph and retained operator closures."""

from alembic import op
from sqlalchemy import text

revision = "geo003"
down_revision = "geo002"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""CREATE TABLE geo.routing_state (
      id boolean PRIMARY KEY DEFAULT true CHECK(id), dirty boolean NOT NULL DEFAULT true,
      built_at timestamptz, source_sha256 text, report jsonb NOT NULL DEFAULT '{}')""")
    op.execute("INSERT INTO geo.routing_state(id) VALUES(true)")
    op.execute("""CREATE TABLE geo.routing_nodes (
      id bigint PRIMARY KEY, geom geometry(Point,4326) NOT NULL,
      tags jsonb NOT NULL DEFAULT '{}')""")
    op.execute("CREATE INDEX routing_nodes_geom ON geo.routing_nodes USING gist(geom)")
    op.execute("""CREATE TABLE geo.routing_edges (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      feature_id bigint NOT NULL REFERENCES geo.features(id), segment integer NOT NULL,
      source bigint NOT NULL REFERENCES geo.routing_nodes(id), target bigint NOT NULL REFERENCES geo.routing_nodes(id),
      geom geometry(LineString,4326) NOT NULL, length_m double precision NOT NULL CHECK(length_m>0),
      tags jsonb NOT NULL, accessibility_verified boolean NOT NULL DEFAULT false,
      UNIQUE(feature_id,segment))""")
    op.execute("CREATE INDEX routing_edges_source ON geo.routing_edges(source)")
    op.execute("CREATE INDEX routing_edges_target ON geo.routing_edges(target)")
    op.execute("""CREATE TABLE geo.path_closures (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      feature_id bigint NOT NULL REFERENCES geo.features(id),
      reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),
      reviewer text NOT NULL CHECK(length(reviewer) BETWEEN 1 AND 160),
      starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz,
      CHECK(ends_at IS NULL OR ends_at>starts_at))""")
    op.execute("CREATE INDEX path_closures_feature ON geo.path_closures(feature_id)")
    op.execute("""CREATE FUNCTION geo.invalidate_routing() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN UPDATE geo.routing_state SET dirty=true; RETURN NULL; END $$""")
    for table in ("features", "verifications"):
        op.execute(
            f"CREATE TRIGGER routing_invalidate AFTER INSERT OR UPDATE OR DELETE ON geo.{table} FOR EACH STATEMENT EXECUTE FUNCTION geo.invalidate_routing()"
        )


def downgrade():
    if (
        op.get_bind()
        .execute(text("SELECT count(*) FROM geo.path_closures"))
        .scalar_one()
    ):
        raise RuntimeError(
            "Routing closures exist: restore a backup instead of destructive downgrade"
        )
    for table in ("features", "verifications"):
        op.execute(f"DROP TRIGGER routing_invalidate ON geo.{table}")
    op.execute("DROP FUNCTION geo.invalidate_routing()")
    for table in ("path_closures", "routing_edges", "routing_nodes", "routing_state"):
        op.execute(f"DROP TABLE geo.{table}")
