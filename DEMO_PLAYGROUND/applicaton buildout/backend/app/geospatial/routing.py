"""Bounded, read-only pgRouting. Coordinates remain in POST bodies."""

import logging
import math
import os
import time
from typing import Annotated, Literal
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import text
from .importer import BOUNDS

log = logging.getLogger(__name__)
Identifier = Annotated[int, Field(strict=True, ge=1, le=9223372036854775807)]


class Endpoint(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    kind: Literal["coordinate", "building", "entrance"]
    id: Identifier | None = None
    longitude: float | None = None
    latitude: float | None = None

    @model_validator(mode="after")
    def validate_endpoint(self):
        if self.kind == "coordinate":
            if (
                self.id is not None
                or self.longitude is None
                or self.latitude is None
                or not (
                    BOUNDS[0] <= self.longitude <= BOUNDS[2]
                    and BOUNDS[1] <= self.latitude <= BOUNDS[3]
                )
            ):
                raise ValueError("Choose coordinates inside the campus study area")
        elif self.id is None or self.longitude is not None or self.latitude is not None:
            raise ValueError("Building/entrance endpoints require only an id")
        return self


class RouteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    origin: Endpoint
    destination: Endpoint
    profile: Literal["walking", "shortest", "step_free"] = "walking"


def setting(name, default, low, high):
    try:
        value = float(os.getenv(name, default))
        if not math.isfinite(value) or not low <= value <= high:
            raise ValueError()
        return value
    except ValueError:
        raise HTTPException(503, "Routing cost configuration is invalid") from None


def edge_query(profile):
    # No user strings enter this SQL; pgRouting accepts fixed SQL with validated numeric settings.
    if profile not in {"walking", "shortest", "step_free"}:
        raise HTTPException(422, "Unknown routing profile")
    speed = setting("GEO_WALK_SPEED_MPS", "1.3", 0.3, 3)
    stairs = setting("GEO_STAIRS_FACTOR", "2", 1, 10)
    rough = setting("GEO_ROUGH_FACTOR", "1.4", 1, 10)
    slope = setting("GEO_SLOPE_FACTOR", "4", 0, 20)
    duration = f"""e.length_m/{speed} * CASE WHEN e.tags->>'highway'='steps' THEN {stairs} ELSE 1 END
      * CASE WHEN e.tags->>'surface' IN ('gravel','unpaved','ground','dirt','sand','cobblestone') THEN {rough} ELSE 1 END
      * (1+CASE WHEN e.accessibility_verified AND e.tags->>'incline' ~ '^-?[0-9]+([.][0-9]+)?%$'
           THEN LEAST(abs(replace(e.tags->>'incline','%','')::float)/100,1)*{slope} ELSE 0 END)"""
    cost = "e.length_m" if profile == "shortest" else duration
    extra = (
        """AND e.tags->>'highway' IS DISTINCT FROM 'steps'
      AND coalesce(e.tags->>'wheelchair','') NOT IN ('no','limited')
      AND coalesce(e.tags->>'surface','') NOT IN ('sand','mud','ground','dirt','cobblestone')
      AND coalesce(a.tags->>'wheelchair','') NOT IN ('no','limited')
      AND coalesce(a.tags->>'kerb','') NOT IN ('raised','rolled')
      AND coalesce(b.tags->>'kerb','') NOT IN ('raised','rolled')
      AND coalesce(b.tags->>'wheelchair','') NOT IN ('no','limited')
      AND NOT (e.accessibility_verified AND CASE WHEN e.tags->>'incline' ~ '^-?[0-9]+([.][0-9]+)?%$'
        THEN abs(replace(e.tags->>'incline','%','')::float)>8.33 ELSE false END)"""
        if profile == "step_free"
        else ""
    )
    return f"""SELECT e.id,e.source,e.target,
      CASE WHEN e.tags->>'oneway:foot'='-1' THEN -1 ELSE {cost} END AS cost,
      CASE WHEN e.tags->>'oneway:foot' IN ('yes','1','true') THEN -1 ELSE {cost} END AS reverse_cost,
      {duration} AS duration_s
      FROM geo.routing_edges e JOIN geo.routing_nodes a ON a.id=e.source JOIN geo.routing_nodes b ON b.id=e.target
      WHERE coalesce(e.tags->>'foot', e.tags->>'access','yes') IN ('yes','designated','permissive','official')
      AND NOT (e.tags ? 'access:conditional' OR e.tags ? 'foot:conditional' OR e.tags ? 'opening_hours')
      AND coalesce(e.tags->>'highway','') NOT IN ('construction','proposed')
      AND NOT (e.tags ? 'construction' OR e.tags ? 'disused:highway')
      AND coalesce(e.tags->>'indoor','no')<>'yes'
      AND coalesce(a.tags->>'foot',a.tags->>'access','yes') IN ('yes','designated','permissive','official')
      AND coalesce(b.tags->>'foot',b.tags->>'access','yes') IN ('yes','designated','permissive','official')
      AND NOT (a.tags ? 'access:conditional' OR a.tags ? 'foot:conditional' OR a.tags ? 'opening_hours'
        OR b.tags ? 'access:conditional' OR b.tags ? 'foot:conditional' OR b.tags ? 'opening_hours')
      AND (coalesce(a.tags->>'barrier','no') IN ('no','bollard','kerb') OR a.tags->>'foot' IN ('yes','designated'))
      AND (coalesce(b.tags->>'barrier','no') IN ('no','bollard','kerb') OR b.tags->>'foot' IN ('yes','designated'))
      AND NOT EXISTS(SELECT 1 FROM geo.path_closures c WHERE c.feature_id=e.feature_id AND c.starts_at<=now() AND (c.ends_at IS NULL OR c.ends_at>now()))
      AND NOT EXISTS(SELECT 1 FROM geo.blip_edges be JOIN geo.blips br ON br.id=be.blip_id
        WHERE be.feature_id=e.feature_id AND be.source=e.source AND be.target=e.target
        AND br.status='active' AND br.verified AND br.expires_at>now())
      {extra} ORDER BY e.id"""


def endpoints(db, endpoint, edges, profile):
    if endpoint.kind == "coordinate":
        candidates = [
            {
                "id": None,
                "longitude": endpoint.longitude,
                "latitude": endpoint.latitude,
                "name": "Selected location",
                "association_verified": False,
                "accessibility_verified": False,
                "tags": {},
            }
        ]
    else:
        exists = db.execute(
            text("SELECT 1 FROM geo.features WHERE id=:id AND kind=:kind"),
            {"id": endpoint.id, "kind": endpoint.kind},
        ).scalar()
        if not exists:
            raise HTTPException(404, f"{endpoint.kind.title()} not found")
        candidates = [
            dict(row)
            for row in db.execute(
                text("""SELECT e.id,e.osm_id,e.effective_name AS name,e.effective_tags AS tags,
          ST_X(e.geom) AS longitude,ST_Y(e.geom) AS latitude,
          coalesce(v.accessibility_verified,false) AS accessibility_verified,
          EXISTS(SELECT 1 FROM geo.building_entrances be WHERE be.building_id=:id AND be.entrance_id=e.id) AS association_verified
          FROM geo.entrances e LEFT JOIN geo.verifications v ON v.id=e.verification_id
          WHERE (:kind='entrance' AND e.id=:id) OR (:kind='building' AND EXISTS (
            SELECT 1 FROM geo.buildings b WHERE b.id=:id AND (ST_DWithin(e.geom::geography,b.geom::geography,3)
            OR EXISTS(SELECT 1 FROM geo.building_entrances be WHERE be.building_id=b.id AND be.entrance_id=e.id))))
          ORDER BY association_verified DESC,e.id LIMIT 9"""),
                {"id": endpoint.id, "kind": endpoint.kind},
            ).mappings()
        ]
        if not candidates and endpoint.kind == "building":
            # Only existing dead-end graph nodes at the footprint boundary qualify.
            # This supplies a path approach, never a fabricated entrance or connector.
            candidates = [
                dict(row)
                for row in db.execute(
                    text("""
              SELECT NULL::bigint AS id,n.id AS osm_id,ST_X(n.geom) AS longitude,ST_Y(n.geom) AS latitude,
                b.effective_name AS name,n.tags || b.effective_tags AS tags,
                false AS association_verified,false AS accessibility_verified,
                'mapped_approach' AS endpoint_type
              FROM geo.buildings b JOIN geo.routing_nodes n
                ON ST_DWithin(ST_Boundary(b.geom)::geography,n.geom::geography,1)
              WHERE b.id=:id
                AND (SELECT count(*) FROM geo.routing_edges e WHERE e.source=n.id OR e.target=n.id)=1
              ORDER BY n.id LIMIT 9
            """),
                    {"id": endpoint.id},
                ).mappings()
            ]
            if not candidates:
                raise HTTPException(
                    422,
                    "This building has no mapped entrance or walkway endpoint at its boundary. Campus map data needs an entrance connection here.",
                )
        if len(candidates) > 8:
            raise HTTPException(
                422,
                "This building has many entrances. Select a specific entrance to route.",
            )
    results = []
    for c in candidates:
        tags = c["tags"]
        if (
            tags.get("entrance") in ("emergency", "exit")
            or tags.get("foot", tags.get("access", "yes"))
            not in ("yes", "designated", "permissive", "official")
            or any(
                k in tags
                for k in ("opening_hours", "access:conditional", "foot:conditional")
            )
        ):
            continue
        if profile == "step_free" and tags.get("wheelchair") in ("no", "limited"):
            continue
        # Nodes only; no fictitious straight walking connector through intervening obstacles.
        row = (
            db.execute(
                text(f"""WITH eligible AS ({edges}) SELECT n.id,
          ST_X(n.geom) AS longitude,ST_Y(n.geom) AS latitude,
          ST_Distance(n.geom::geography,ST_SetSRID(ST_Point(:lon,:lat),4326)::geography) AS gap_m
          FROM geo.routing_nodes n WHERE ST_DWithin(n.geom::geography,ST_SetSRID(ST_Point(:lon,:lat),4326)::geography,:radius)
          AND (CAST(:osm_id AS bigint) IS NULL OR n.id=:osm_id OR NOT EXISTS(SELECT 1 FROM geo.routing_nodes known WHERE known.id=:osm_id))
          AND EXISTS(SELECT 1 FROM eligible e WHERE e.source=n.id OR e.target=n.id)
          ORDER BY gap_m,n.id LIMIT 1"""),
                {
                    "lon": c["longitude"],
                    "lat": c["latitude"],
                    "radius": 25 if endpoint.kind == "coordinate" else 3,
                    "osm_id": c.get("osm_id"),
                },
            )
            .mappings()
            .first()
        )
        if row:
            results.append(
                {
                    **c,
                    "node": row["id"],
                    "snapped": [row["longitude"], row["latitude"]],
                    "gap_m": round(row["gap_m"], 2),
                    "kind": endpoint.kind,
                }
            )
    if not results:
        raise HTTPException(
            422,
            "Mapped entrances or approaches here do not connect to a usable path for this profile. Access restrictions, closures, or incomplete mapping may prevent routing.",
        )
    return results


def route(db, request):
    started = time.monotonic()
    state = db.execute(text("SELECT * FROM geo.routing_state")).mappings().first()
    if not state or state["dirty"] or not state["built_at"]:
        raise HTTPException(503, "Walking routes are awaiting a graph rebuild")
    edges = edge_query(request.profile)
    resolved = []
    for label, endpoint in (("From", request.origin), ("To", request.destination)):
        try:
            resolved.append(endpoints(db, endpoint, edges, request.profile))
        except HTTPException as exc:
            raise HTTPException(exc.status_code, f"{label}: {exc.detail}") from None
    origins, destinations = resolved
    rows = (
        db.execute(
            text(
                "SELECT * FROM pgr_dijkstra(:edges,CAST(:origins AS bigint[]),CAST(:destinations AS bigint[]),true)"
            ),
            {
                "edges": edges,
                "origins": sorted({c["node"] for c in origins}),
                "destinations": sorted({c["node"] for c in destinations}),
            },
        )
        .mappings()
        .all()
    )
    options = [
        (r["agg_cost"], r["start_vid"], r["end_vid"]) for r in rows if r["edge"] == -1
    ]
    options.extend(
        (0, o["node"], d["node"])
        for o in origins
        for d in destinations
        if o["node"] == d["node"]
    )
    if not options:
        raise HTTPException(
            422,
            "No connected route is available for this profile. Try another entrance or profile; campus path coverage is incomplete.",
        )
    _, start, end = min(options)
    origin = next(c for c in origins if c["node"] == start)
    destination = next(c for c in destinations if c["node"] == end)
    steps = sorted(
        (
            r
            for r in rows
            if r["start_vid"] == start and r["end_vid"] == end and r["edge"] != -1
        ),
        key=lambda r: r["path_seq"],
    )
    details = {
        r["id"]: dict(r)
        for r in db.execute(
            text(f"""WITH eligible AS ({edges}) SELECT e.*,q.duration_s,
        ST_AsGeoJSON(e.geom)::json AS geometry,f.effective_name AS name
        FROM geo.routing_edges e JOIN eligible q ON q.id=e.id JOIN geo.paths f ON f.id=e.feature_id
        WHERE e.id=ANY(CAST(:ids AS bigint[]))"""),
            {"ids": [r["edge"] for r in steps]},
        ).mappings()
    }
    coordinates, paths, instructions = [], [], []
    distance = duration = 0
    verified = bool(steps)
    for step in steps:
        e = details[step["edge"]]
        points = e["geometry"]["coordinates"]
        if step["node"] != e["source"]:
            points = list(reversed(points))
        coordinates.extend(points if not coordinates else points[1:])
        distance += e["length_m"]
        duration += e["duration_s"]
        verified = (
            verified
            and e["accessibility_verified"]
            and e["tags"].get("wheelchair") == "yes"
            and e["tags"].get("highway") != "steps"
        )
        if not paths or paths[-1] != e["feature_id"]:
            paths.append(e["feature_id"])
            instructions.append(
                {
                    "path_id": e["feature_id"],
                    "text": e["name"]
                    or (
                        "Follow the stairs"
                        if e["tags"].get("highway") == "steps"
                        else "Follow the mapped pedestrian path"
                    ),
                    "distance_m": 0,
                }
            )
        instructions[-1]["distance_m"] += e["length_m"]
    if not coordinates:
        coordinates = [origin["snapped"], origin["snapped"]]
    for item in instructions:
        item["distance_m"] = round(item["distance_m"], 1)
    warnings = [
        "Campus path and entrance data is incomplete. Follow posted restrictions and check conditions on site."
    ]
    if not verified:
        warnings.append(
            "Accessibility has not been verified for the entire route. This is not a guaranteed wheelchair-accessible route."
        )
    if verified:
        warnings.append(
            "Path reviews do not verify every entrance, crossing, or curb. This is not a guaranteed wheelchair-accessible route."
        )
    for label, point in (("Start", origin), ("Finish", destination)):
        if point.get("endpoint_type") == "mapped_approach":
            warnings.append(
                f"{label} is a mapped walkway endpoint at the building boundary, not a verified entrance. Locate a permitted door on site."
            )
    if request.profile == "step_free":
        warnings.append(
            "Avoids mapped stairs and known barriers; missing surface, slope, and curb details may still affect access."
        )
    if any(
        not c["association_verified"]
        for c in (origin, destination)
        if c["kind"] == "building"
    ):
        warnings.append(
            "Building entrance associations are based on unverified proximity."
        )
    if any(c["gap_m"] > 0.05 for c in (origin, destination)):
        warnings.append(
            "The route starts/ends at a nearby path node. Gaps to your selections are not mapped walking connections and are excluded from distance/time."
        )
    if start == end:
        warnings.append(
            "Both selections resolve to the same path node; no network travel is required."
        )
    log.info(
        "campus_route profile=%s edges=%d latency_ms=%.1f",
        request.profile,
        len(steps),
        (time.monotonic() - started) * 1000,
    )
    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString" if steps else "Point",
            "coordinates": coordinates if steps else coordinates[0],
        },
        "properties": {
            "kind": "route",
            "profile": request.profile,
            "distance_m": round(distance, 1),
            "duration_s": round(duration),
            "path_ids": paths,
            "instructions": instructions,
            "warnings": warnings,
            "confidence": "source_topology_unverified",
            "path_accessibility_verified": bool(verified),
            "origin": origin,
            "destination": destination,
            "graph_built_at": state["built_at"].isoformat(),
            "bounds": [
                min(p[0] for p in coordinates),
                min(p[1] for p in coordinates),
                max(p[0] for p in coordinates),
                max(p[1] for p in coordinates),
            ],
            "attribution": "© OpenStreetMap contributors",
            "license": "ODbL-1.0",
        },
    }
