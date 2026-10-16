import math
from fastapi import HTTPException
from sqlalchemy import text
from .importer import BOUNDS

KINDS = {"building", "entrance", "path", "intersection", "landmark"}


def parse_bbox(value):
    try:
        west, south, east, north = [float(v) for v in value.split(",")]
    except (ValueError, TypeError):
        raise HTTPException(422, "bbox must be west,south,east,north") from None
    if not all(math.isfinite(v) for v in (west, south, east, north)) or not (
        BOUNDS[0] <= west < east <= BOUNDS[2] and BOUNDS[1] <= south < north <= BOUNDS[3]
    ):
        raise HTTPException(422, "bbox must be ordered and within -84.80,43.56,-84.74,43.62")
    return {"west": west, "south": south, "east": east, "north": north}


def feature_collection(connection, bbox, kind=None, limit=200, after=0, feature_id=None, building_id=None):
    if kind is not None and kind not in KINDS:
        raise HTTPException(422, "Unknown geographic feature kind")
    rows = connection.execute(text("""SELECT f.id,f.kind,f.osm_type,f.osm_id,f.osm_version,
       f.effective_name AS name,f.effective_tags AS tags,f.verification_id,
       coalesce((SELECT v.accessibility_verified FROM geo.verifications v WHERE v.id=f.verification_id),false) AS accessibility_verified,
       EXISTS(SELECT 1 FROM geo.building_entrances be WHERE be.building_id=:building_id AND be.entrance_id=f.id) AS association_verified,
       json_build_array(ST_XMin(f.geom),ST_YMin(f.geom),ST_XMax(f.geom),ST_YMax(f.geom)) AS bounds,
       ST_AsGeoJSON(f.geom)::json AS geometry,
       CASE WHEN f.kind='path' THEN ST_Length(f.geom::geography) END AS length_m,
       s.url AS source_url,s.license,s.attribution,s.captured_at
       FROM geo.effective_features f JOIN geo.sources s ON s.id=f.source_id
       WHERE f.geom && ST_MakeEnvelope(:west,:south,:east,:north,4326)
       AND ST_Intersects(f.geom,ST_MakeEnvelope(:west,:south,:east,:north,4326))
       AND (CAST(:kind AS text) IS NULL OR f.kind=:kind)
       AND (CAST(:feature_id AS bigint) IS NULL OR f.id=:feature_id)
       AND (CAST(:building_id AS bigint) IS NULL OR EXISTS (SELECT 1 FROM geo.buildings b WHERE b.id=:building_id AND (ST_DWithin(f.geom::geography,b.geom::geography,3) OR EXISTS(SELECT 1 FROM geo.building_entrances be WHERE be.building_id=b.id AND be.entrance_id=f.id))))
       AND f.id>:after ORDER BY f.id LIMIT :limit"""),
       {**bbox, "kind": kind, "feature_id": feature_id, "building_id": building_id, "after": after, "limit": limit+1}).mappings().all()
    more = len(rows) > limit
    features = []
    for row in rows[:limit]:
        props = dict(row)
        geometry = props.pop("geometry")
        props["captured_at"] = props["captured_at"].isoformat()
        props["verified"] = props.pop("verification_id") is not None
        features.append({"type": "Feature", "id": row["id"], "geometry": geometry, "properties": props})
    return {"type": "FeatureCollection", "features": features,
            "next_after": features[-1]["id"] if more else None,
            "attribution": "© OpenStreetMap contributors", "license": "ODbL-1.0",
            "notice": "Unverified source data; accessibility and connectivity are not guaranteed"}


def quality_report(connection):
    checks = {
        "missing_building_names": "SELECT id FROM geo.buildings WHERE coalesce(trim(effective_name),'')=''",
        "missing_entrances": "SELECT b.id FROM geo.buildings b WHERE NOT EXISTS (SELECT 1 FROM geo.entrances e WHERE ST_DWithin(b.geom::geography,e.geom::geography,3))",
        "missing_accessibility": "SELECT id FROM geo.effective_features WHERE kind IN ('path','entrance') AND NOT effective_tags ? 'wheelchair'",
        "invalid_buildings": "SELECT id FROM geo.buildings WHERE NOT ST_IsValid(geom)",
        "duplicate_paths": "SELECT a.id,b.id AS other_id FROM geo.paths a JOIN geo.paths b ON a.id<b.id AND a.geom && b.geom AND ST_Equals(a.geom,b.geom)",
        "unconnected_paths": "SELECT a.id FROM geo.paths a WHERE NOT EXISTS (SELECT 1 FROM geo.paths b WHERE a.id<>b.id AND EXISTS (SELECT 1 FROM jsonb_array_elements(a.node_ids) an JOIN jsonb_array_elements(b.node_ids) bn ON an.value=bn.value))",
        "unexpected_crossings": "SELECT a.id,b.id AS other_id FROM geo.paths a JOIN geo.paths b ON a.id<b.id AND a.geom && b.geom AND ST_Crosses(a.geom,b.geom) WHERE NOT (EXISTS (SELECT 1 FROM jsonb_array_elements(a.node_ids) an JOIN jsonb_array_elements(b.node_ids) bn ON an.value=bn.value))",
    }
    return {"checks": {name: [dict(row) for row in connection.execute(text(sql)).mappings()] for name, sql in checks.items()},
            "note": "Proximity is a review candidate only. OSM shared nodes are not a verified routing graph; crossings never create connections."}
