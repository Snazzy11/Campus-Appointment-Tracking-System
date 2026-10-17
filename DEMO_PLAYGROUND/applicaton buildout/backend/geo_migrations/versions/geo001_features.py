"""Add geographic entities and provenance without touching public messaging tables."""
from alembic import op
from sqlalchemy import text

revision = "geo001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgrouting")
    op.execute("CREATE SCHEMA geo")
    op.execute("""CREATE TABLE geo.sources (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name text NOT NULL, url text NOT NULL, license text NOT NULL,
        sha256 text NOT NULL UNIQUE CHECK(length(sha256)=64),
        captured_at timestamptz NOT NULL, imported_at timestamptz NOT NULL DEFAULT now(),
        attribution text NOT NULL
    )""")
    op.execute("""CREATE TABLE geo.features (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        kind text NOT NULL CHECK(kind IN ('building','entrance','path','intersection','landmark')),
        osm_type text NOT NULL CHECK(osm_type IN ('node','way','relation')),
        osm_id bigint NOT NULL CHECK(osm_id>0), osm_version integer NOT NULL CHECK(osm_version>0),
        source_id bigint NOT NULL REFERENCES geo.sources(id),
        name text, tags jsonb NOT NULL DEFAULT '{}', node_ids jsonb NOT NULL DEFAULT '[]',
        geom geometry(Geometry,4326) NOT NULL,
        imported_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(kind,osm_type,osm_id),
        CHECK(ST_IsValid(geom) AND NOT ST_IsEmpty(geom) AND ST_NDims(geom)=2),
        CHECK(ST_CoveredBy(geom,ST_MakeEnvelope(-84.80,43.56,-84.74,43.62,4326))),
        CHECK((kind='building' AND GeometryType(geom) IN ('POLYGON','MULTIPOLYGON')) OR
              (kind='path' AND GeometryType(geom)='LINESTRING') OR
              (kind IN ('entrance','intersection','landmark') AND GeometryType(geom)='POINT'))
    )""")
    op.execute("CREATE INDEX features_geom_gist ON geo.features USING gist(geom)")
    op.execute("CREATE INDEX features_kind_id ON geo.features(kind,id)")
    op.execute("""CREATE TABLE geo.verifications (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        feature_id bigint NOT NULL REFERENCES geo.features(id),
        reviewer text NOT NULL CHECK(length(reviewer) BETWEEN 1 AND 160),
        note text NOT NULL CHECK(length(note) BETWEEN 1 AND 2000),
        name_override text, geom_override geometry(Geometry,4326), tags_override jsonb NOT NULL DEFAULT '{}',
        verified_at timestamptz NOT NULL DEFAULT now()
    )""")
    op.execute("""CREATE FUNCTION geo.check_override() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE feature_kind text;
      BEGIN
        SELECT kind INTO feature_kind FROM geo.features WHERE id=NEW.feature_id;
        IF NEW.geom_override IS NOT NULL AND NOT (
          ST_IsValid(NEW.geom_override) AND NOT ST_IsEmpty(NEW.geom_override) AND ST_NDims(NEW.geom_override)=2
          AND ST_CoveredBy(NEW.geom_override,ST_MakeEnvelope(-84.80,43.56,-84.74,43.62,4326))
          AND ((feature_kind='building' AND GeometryType(NEW.geom_override) IN ('POLYGON','MULTIPOLYGON'))
          OR (feature_kind='path' AND GeometryType(NEW.geom_override)='LINESTRING')
          OR (feature_kind IN ('entrance','intersection','landmark') AND GeometryType(NEW.geom_override)='POINT')))
        THEN RAISE EXCEPTION 'Invalid geographic override'; END IF;
        RETURN NEW;
      END $$""")
    op.execute("CREATE TRIGGER validate_override BEFORE INSERT OR UPDATE ON geo.verifications FOR EACH ROW EXECUTE FUNCTION geo.check_override()")
    op.execute("CREATE INDEX verifications_feature_id ON geo.verifications(feature_id,id DESC)")
    op.execute("""CREATE VIEW geo.effective_features AS
      SELECT f.id,f.kind,f.osm_type,f.osm_id,f.osm_version,f.source_id,f.name,f.tags,f.node_ids,f.imported_at,
             f.geom AS source_geom,coalesce(v.geom_override,f.geom) AS geom,
             coalesce(v.name_override,f.name) AS effective_name,
             f.tags || coalesce(v.tags_override,'{}'::jsonb) AS effective_tags,
             v.id AS verification_id
      FROM geo.features f LEFT JOIN LATERAL
       (SELECT * FROM geo.verifications WHERE feature_id=f.id ORDER BY id DESC LIMIT 1) v ON true""")
    for view, kind in (("buildings", "building"), ("entrances", "entrance"), ("paths", "path"),
                       ("intersections", "intersection"), ("landmarks", "landmark")):
        op.execute(f"CREATE VIEW geo.{view} AS SELECT * FROM geo.effective_features WHERE kind='{kind}'")


def downgrade():
    if op.get_bind().execute(text("SELECT (SELECT count(*) FROM geo.features)+(SELECT count(*) FROM geo.sources)+(SELECT count(*) FROM geo.verifications)")).scalar_one():
        raise RuntimeError("Geographic records exist: restore a backup instead of destructive downgrade")
    for view in ("buildings", "entrances", "paths", "intersections", "landmarks", "effective_features"):
        op.execute(f"DROP VIEW geo.{view}")
    for table in ("verifications", "features", "sources"):
        op.execute(f"DROP TABLE geo.{table}")
    op.execute("DROP FUNCTION IF EXISTS geo.check_override()")
    op.execute("DROP SCHEMA geo")
    # Shared extensions are intentionally retained.
