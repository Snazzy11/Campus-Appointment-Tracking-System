"""Read-only review inventory; candidates are never asserted to be doors."""
from sqlalchemy import text


def entrance_candidates(db):
    rows = db.execute(text("""
        SELECT b.id AS building_id,b.effective_name AS building_name,
          n.id AS osm_node_id,ST_AsGeoJSON(n.geom)::json AS geometry
        FROM geo.buildings b JOIN geo.routing_nodes n
          ON ST_DWithin(ST_Boundary(b.geom)::geography,n.geom::geography,1)
        WHERE (SELECT count(*) FROM geo.routing_edges e
               WHERE e.source=n.id OR e.target=n.id)=1
          AND NOT EXISTS (SELECT 1 FROM geo.entrances x
                          WHERE ST_DWithin(x.geom::geography,n.geom::geography,3))
        ORDER BY b.id,n.id
    """)).mappings()
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": row["geometry"], "properties": {
            "building_id": row["building_id"], "building_name": row["building_name"],
            "osm_node_id": row["osm_node_id"], "status": "unverified_candidate",
            "public_access_verified": False, "accessibility_verified": False,
            "evidence": "Existing mapped path dead end within 1m of building boundary",
        }} for row in rows
    ]}
