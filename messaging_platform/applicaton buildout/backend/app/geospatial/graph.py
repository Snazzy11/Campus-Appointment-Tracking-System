"""Operator-only graph rebuild. Topology is OSM identity, never spatial proximity."""

import hashlib
import json
from sqlalchemy import text
from .importer import load_document


def build_graph(db, raw, captured_at=None):
    if len(raw) > 20_000_000:
        raise ValueError("Snapshot exceeds 20 MB")
    document = load_document(raw, captured_at)
    nodes = {e["id"]: e for e in document["elements"] if e["type"] == "node"}
    ways = {e["id"]: e for e in document["elements"] if e["type"] == "way"}
    # Serialize with imports/reviews and other rebuilds; readers see the previous committed graph.
    db.execute(text("LOCK TABLE geo.features,geo.verifications IN SHARE MODE"))
    db.execute(text("SELECT id FROM geo.routing_state FOR UPDATE"))
    paths = (
        db.execute(
            text("""SELECT p.*, ST_AsGeoJSON(p.geom)::json AS geometry,
      ST_Equals(p.geom,p.source_geom) AS unchanged,
      coalesce(v.accessibility_verified,false) AS accessibility_verified
      FROM geo.paths p LEFT JOIN geo.verifications v ON v.id=p.verification_id ORDER BY p.id""")
        )
        .mappings()
        .all()
    )
    for entrance in db.execute(
        text(
            "SELECT osm_id,effective_tags,ST_Equals(geom,source_geom) AS unchanged FROM geo.entrances"
        )
    ).mappings():
        if entrance["osm_id"] in nodes:
            nodes[entrance["osm_id"]]["tags"] = (
                dict(entrance["effective_tags"])
                if entrance["unchanged"]
                else {"access": "no"}
            )
    segments, used, rejected = [], set(), []
    for path in paths:
        way = ways.get(path["osm_id"])
        ids = path["node_ids"]
        coords = path["geometry"]["coordinates"]
        if (
            not path["unchanged"]
            or not way
            or way["version"] != path["osm_version"]
            or way.get("nodes") != ids
            or len(ids) != len(coords)
        ):
            rejected.append(
                {
                    "feature_id": path["id"],
                    "reason": "Source topology/version mismatch or geometry override",
                }
            )
            continue
        if any(
            n not in nodes or [nodes[n]["lon"], nodes[n]["lat"]] != point
            for n, point in zip(ids, coords)
        ):
            rejected.append(
                {
                    "feature_id": path["id"],
                    "reason": "Missing or inconsistent source node",
                }
            )
            continue
        if path["effective_tags"].get("area") == "yes":
            rejected.append(
                {
                    "feature_id": path["id"],
                    "reason": "Pedestrian area requires a surveyed centerline",
                }
            )
            continue
        for index, (a, b) in enumerate(zip(ids, ids[1:])):
            if a == b or coords[index] == coords[index + 1]:
                continue
            used.update((a, b))
            segments.append(
                {
                    "feature": path["id"],
                    "segment": index,
                    "source": a,
                    "target": b,
                    "geom": json.dumps(
                        {"type": "LineString", "coordinates": coords[index : index + 2]}
                    ),
                    "tags": json.dumps(path["effective_tags"]),
                    "verified": path["accessibility_verified"],
                }
            )
    if not segments:
        raise ValueError("No usable graph edges; previous graph retained")
    db.execute(text("DELETE FROM geo.routing_edges"))
    db.execute(text("DELETE FROM geo.routing_nodes"))
    db.execute(
        text("""INSERT INTO geo.routing_nodes(id,geom,tags)
      VALUES(:id,ST_SetSRID(ST_Point(:lon,:lat),4326),CAST(:tags AS jsonb))"""),
        [
            {
                "id": n,
                "lon": nodes[n]["lon"],
                "lat": nodes[n]["lat"],
                "tags": json.dumps(nodes[n].get("tags", {})),
            }
            for n in sorted(used)
        ],
    )
    db.execute(
        text("""INSERT INTO geo.routing_edges(feature_id,segment,source,target,geom,length_m,tags,accessibility_verified)
      VALUES(:feature,:segment,:source,:target,ST_GeomFromGeoJSON(:geom),ST_Length(ST_GeomFromGeoJSON(:geom)::geography),CAST(:tags AS jsonb),:verified)"""),
        segments,
    )
    components = db.execute(
        text(
            "SELECT count(DISTINCT component) FROM pgr_connectedComponents('SELECT id,source,target,length_m AS cost FROM geo.routing_edges')"
        )
    ).scalar_one()
    report = {
        "nodes": len(used),
        "edges": len(segments),
        "components_before_restrictions": components,
        "rejected": rejected,
    }
    db.execute(
        text(
            """UPDATE geo.routing_state SET dirty=false,built_at=now(),source_sha256=:sha,report=CAST(:report AS jsonb)"""
        ),
        {"sha": hashlib.sha256(raw).hexdigest(), "report": json.dumps(report)},
    )
    return report
