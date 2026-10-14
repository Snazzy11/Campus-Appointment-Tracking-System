"""Bounded, atomic OSM snapshot ingestion. No network during import."""
import hashlib
import json
from collections import Counter
from datetime import datetime
from xml.etree import ElementTree
from sqlalchemy import text

BOUNDS = (-84.80, 43.56, -84.74, 43.62)
PATHS = {"footway", "pedestrian", "path", "steps"}


def load_document(raw, captured_at=None):
    if not raw.lstrip().startswith(b"<"):
        return json.loads(raw)
    if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise ValueError("XML document declarations/entities are not accepted")
    if not captured_at:
        raise ValueError("XML extracts require an explicit captured-at timestamp")
    root = ElementTree.fromstring(raw)
    if root.tag != "osm":
        raise ValueError("Expected OSM XML root")
    nodes = {int(n.attrib["id"]): {"lon": float(n.attrib["lon"]), "lat": float(n.attrib["lat"])}
             for n in root.findall("node")}
    elements = []
    for item in root:
        if item.tag not in {"node", "way", "relation"}:
            continue
        e = {"type": item.tag, "id": int(item.attrib["id"]), "version": int(item.attrib["version"]),
             "tags": {t.attrib["k"]: t.attrib["v"] for t in item.findall("tag")}}
        if item.tag == "node":
            e.update(nodes[e["id"]])
        elif item.tag == "way":
            e["nodes"] = [int(n.attrib["ref"]) for n in item.findall("nd")]
            e["geometry"] = [nodes[n] for n in e["nodes"] if n in nodes]
            if len(e["geometry"]) != len(e["nodes"]):
                e["geometry"] = []  # rejected by geometry validation, never bridge missing nodes
        elements.append(e)
    return {"osm3s": {"timestamp_osm_base": captured_at}, "elements": elements}


def extract(document):
    elements = document.get("elements", [])
    if not isinstance(elements, list) or len(elements) > 50000:
        raise ValueError("Snapshot must contain at most 50,000 elements")
    features, rejected = [], []
    for e in elements:
        tags, typ = e.get("tags", {}), e.get("type")
        kind = None
        if typ == "way" and tags.get("building") not in (None, "no"):
            kind = "building"
        elif typ == "way" and tags.get("highway") in PATHS:
            kind = "path"
        elif typ == "node" and tags.get("entrance") not in (None, "no"):
            kind = "entrance"
        elif typ == "node" and (tags.get("historic") or tags.get("tourism") in {"artwork", "attraction"}):
            kind = "landmark"
        elif typ == "relation" and tags.get("building"):
            rejected.append({"osm_id": e["id"], "reason": "Multipolygon relation assembly requires review"})
        if kind is None:
            continue
        try:
            if typ == "node":
                coords = [e["lon"], e["lat"]]
                geom = {"type": "Point", "coordinates": coords}
            else:
                coords = [[n["lon"], n["lat"]] for n in e["geometry"]]
                if len(coords) < 2:
                    raise ValueError("Incomplete way geometry")
                if kind == "building" and (len(coords) < 4 or coords[0] != coords[-1]):
                    raise ValueError("Building ring is not closed")
                geom = {"type": "Polygon" if kind == "building" else "LineString",
                        "coordinates": [coords] if kind == "building" else coords}
            points = [coords] if typ == "node" else coords
            if any(len(p) != 2 or not (BOUNDS[0] <= p[0] <= BOUNDS[2] and BOUNDS[1] <= p[1] <= BOUNDS[3]) for p in points):
                raise ValueError("Outside documented campus study boundary")
            if not isinstance(e.get("version"), int) or e["version"] < 1:
                raise ValueError("Missing OSM version; use out meta geom")
            features.append({"kind": kind, "osm_type": typ, "osm_id": e["id"],
                             "osm_version": e["version"], "name": tags.get("name"),
                             "tags": json.dumps(tags), "node_ids": json.dumps(e.get("nodes", [])),
                             "geometry": json.dumps(geom)})
        except (KeyError, TypeError, ValueError) as exc:
            rejected.append({"osm_id": e.get("id"), "reason": str(exc)})
    # Shared original OSM nodes are candidate intersections, never geometric crossings.
    counts = Counter(n for f in features if f["kind"] == "path" for n in set(json.loads(f["node_ids"])))
    nodes = {e["id"]: e for e in elements if e.get("type") == "node"}
    for node_id, count in counts.items():
        if count < 2 or node_id not in nodes:
            continue
        e = nodes[node_id]
        if not (BOUNDS[0] <= e.get("lon", 0) <= BOUNDS[2] and BOUNDS[1] <= e.get("lat", 0) <= BOUNDS[3]) or not e.get("version"):
            continue
        features.append({"kind": "intersection", "osm_type": "node", "osm_id": node_id,
                         "osm_version": e["version"], "name": None, "tags": json.dumps(e.get("tags", {})),
                         "node_ids": "[]", "geometry": json.dumps({"type": "Point", "coordinates": [e["lon"], e["lat"]]})})
    return features, rejected


def import_snapshot(connection, raw, url, captured_at=None):
    if len(raw) > 20_000_000:
        raise ValueError("Snapshot exceeds 20 MB")
    if not url.startswith("https://"):
        raise ValueError("Source URL must be HTTPS")
    document = load_document(raw, captured_at)
    captured = document.get("osm3s", {}).get("timestamp_osm_base")
    if not captured:
        raise ValueError("OSM base timestamp is required")
    datetime.fromisoformat(captured.replace("Z", "+00:00"))
    features, rejected = extract(document)
    source = connection.execute(text("""INSERT INTO geo.sources(name,url,license,sha256,captured_at,attribution)
      VALUES ('OpenStreetMap',:url,'ODbL-1.0',:sha,CAST(:captured AS timestamptz),'© OpenStreetMap contributors')
      ON CONFLICT(sha256) DO UPDATE SET sha256=excluded.sha256 RETURNING id"""),
      {"url": url, "sha": hashlib.sha256(raw).hexdigest(), "captured": captured}).scalar_one()
    changed = 0
    for f in features:
        valid = connection.execute(text("SELECT ST_IsValid(ST_GeomFromGeoJSON(:geometry)) AND NOT ST_IsEmpty(ST_GeomFromGeoJSON(:geometry))"), f).scalar_one()
        if not valid:
            rejected.append({"osm_id": f["osm_id"], "reason": "Invalid or empty geometry"})
            continue
        result = connection.execute(text("""INSERT INTO geo.features
          (kind,osm_type,osm_id,osm_version,source_id,name,tags,node_ids,geom)
          VALUES (:kind,:osm_type,:osm_id,:osm_version,:source_id,:name,CAST(:tags AS jsonb),CAST(:node_ids AS jsonb),ST_GeomFromGeoJSON(:geometry))
          ON CONFLICT(kind,osm_type,osm_id) DO UPDATE SET
          osm_version=excluded.osm_version,source_id=excluded.source_id,name=excluded.name,
          tags=excluded.tags,node_ids=excluded.node_ids,geom=excluded.geom,imported_at=now()
          WHERE excluded.osm_version>geo.features.osm_version RETURNING id"""), {**f, "source_id": source})
        changed += result.fetchone() is not None
    return {"source_id": source, "changed": changed, "rejected": rejected,
            "counts": dict(Counter(f["kind"] for f in features)),
            "deletion_policy": "Missing objects retained; complete deletion diffs are not inferred from bbox snapshots"}
