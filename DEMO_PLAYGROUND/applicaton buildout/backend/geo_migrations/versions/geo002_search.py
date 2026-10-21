"""Indexed building search, reviewed aliases and explicit entrance/accessibility verification."""
from alembic import op
from sqlalchemy import text

revision = "geo002"
down_revision = "geo001"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("ALTER TABLE geo.verifications ADD COLUMN accessibility_verified boolean NOT NULL DEFAULT false")
    op.execute("""CREATE TABLE geo.building_aliases (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      building_id bigint NOT NULL REFERENCES geo.features(id),
      label text NOT NULL CHECK(length(trim(label)) BETWEEN 2 AND 160),
      kind text NOT NULL CHECK(kind IN ('alias','abbreviation')),
      reviewer text NOT NULL CHECK(length(trim(reviewer)) BETWEEN 1 AND 160),
      note text NOT NULL CHECK(length(trim(note)) BETWEEN 1 AND 2000),
      verified_at timestamptz NOT NULL DEFAULT now())""")
    op.execute("CREATE UNIQUE INDEX building_alias_label ON geo.building_aliases(building_id,lower(trim(label)))")
    op.execute("""CREATE TABLE geo.building_entrances (
      building_id bigint NOT NULL REFERENCES geo.features(id),
      entrance_id bigint NOT NULL REFERENCES geo.features(id),
      reviewer text NOT NULL CHECK(length(trim(reviewer)) BETWEEN 1 AND 160),
      note text NOT NULL CHECK(length(trim(note)) BETWEEN 1 AND 2000),
      verified_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(building_id,entrance_id))""")
    op.execute("""CREATE FUNCTION geo.check_building_reference() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NOT EXISTS(SELECT 1 FROM geo.features WHERE id=NEW.building_id AND kind='building') THEN
          RAISE EXCEPTION 'A building feature is required'; END IF;
        IF TG_TABLE_NAME='building_entrances' THEN
          IF NOT EXISTS(SELECT 1 FROM geo.features WHERE id=NEW.entrance_id AND kind='entrance') THEN
            RAISE EXCEPTION 'An entrance feature is required'; END IF;
        END IF;
        RETURN NEW;
      END $$""")
    for table in ("building_aliases", "building_entrances"):
        op.execute(f"CREATE TRIGGER check_building_reference BEFORE INSERT OR UPDATE ON geo.{table} FOR EACH ROW EXECUTE FUNCTION geo.check_building_reference()")
    op.execute("""CREATE TABLE geo.building_search_terms (
      building_id bigint NOT NULL REFERENCES geo.features(id) ON DELETE CASCADE,
      term text NOT NULL, kind text NOT NULL,
      normalized text GENERATED ALWAYS AS (lower(trim(term))) STORED,
      PRIMARY KEY(building_id,term,kind))""")
    op.execute("CREATE INDEX building_search_prefix ON geo.building_search_terms(normalized text_pattern_ops)")
    op.execute("CREATE INDEX building_search_contains ON geo.building_search_terms USING gin(normalized gin_trgm_ops)")
    op.execute("""CREATE FUNCTION geo.refresh_building_terms(target bigint) RETURNS void LANGUAGE plpgsql AS $$
      BEGIN
        DELETE FROM geo.building_search_terms WHERE building_id=target;
        INSERT INTO geo.building_search_terms(building_id,term,kind)
          SELECT id,trim(effective_name),'name' FROM geo.buildings
          WHERE id=target AND coalesce(trim(effective_name),'')<>''
          UNION SELECT building_id,trim(label),kind FROM geo.building_aliases WHERE building_id=target;
      END $$""")
    op.execute("""CREATE FUNCTION geo.refresh_building_search() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_TABLE_NAME='features' THEN
          PERFORM geo.refresh_building_terms(NEW.id);
        ELSIF TG_TABLE_NAME='verifications' THEN
          IF TG_OP<>'INSERT' THEN PERFORM geo.refresh_building_terms(OLD.feature_id); END IF;
          IF TG_OP<>'DELETE' THEN PERFORM geo.refresh_building_terms(NEW.feature_id); END IF;
        ELSE
          IF TG_OP<>'INSERT' THEN PERFORM geo.refresh_building_terms(OLD.building_id); END IF;
          IF TG_OP<>'DELETE' THEN PERFORM geo.refresh_building_terms(NEW.building_id); END IF;
        END IF;
        RETURN NULL;
      END $$""")
    op.execute("CREATE TRIGGER refresh_building_search AFTER INSERT OR UPDATE ON geo.features FOR EACH ROW EXECUTE FUNCTION geo.refresh_building_search()")
    for table in ("verifications", "building_aliases"):
        op.execute(f"CREATE TRIGGER refresh_building_search AFTER INSERT OR UPDATE OR DELETE ON geo.{table} FOR EACH ROW EXECUTE FUNCTION geo.refresh_building_search()")
    op.execute("SELECT geo.refresh_building_terms(id) FROM geo.buildings")


def downgrade():
    if op.get_bind().execute(text("SELECT (SELECT count(*) FROM geo.building_aliases)+(SELECT count(*) FROM geo.building_entrances)+(SELECT count(*) FROM geo.verifications WHERE accessibility_verified)")).scalar_one():
        raise RuntimeError("Reviewed geographic data exists; preserve it before downgrading search")
    for table in ("features", "verifications", "building_aliases"):
        op.execute(f"DROP TRIGGER refresh_building_search ON geo.{table}")
    op.execute("DROP FUNCTION geo.refresh_building_search()")
    op.execute("DROP FUNCTION geo.refresh_building_terms(bigint)")
    for table in ("building_search_terms", "building_aliases", "building_entrances"):
        op.execute(f"DROP TABLE geo.{table}")
    op.execute("DROP FUNCTION geo.check_building_reference()")
    op.execute("ALTER TABLE geo.verifications DROP COLUMN accessibility_verified")
