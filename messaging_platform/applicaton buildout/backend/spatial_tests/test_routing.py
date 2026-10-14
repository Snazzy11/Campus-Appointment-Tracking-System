# ruff: noqa: F811
"""Deterministic tests against real PostGIS/pgRouting, isolated database only."""

import json
import pytest
from fastapi import HTTPException, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.geospatial.graph import build_graph
from app.geospatial.importer import import_snapshot
from app.geospatial.routing import Endpoint, RouteRequest, route
from app.geospatial.database import get_geo_db
from app.routers.geographic import router
from spatial_tests.test_spatial import engine, db, URL  # noqa: F401

pytestmark = pytest.mark.skipif(not URL, reason="Requires isolated PostGIS database")
POINTS = {
    1: [-84.78, 43.59],
    2: [-84.779, 43.59],
    3: [-84.778, 43.59],
    4: [-84.779, 43.5905],
    5: [-84.776, 43.592],
    6: [-84.775, 43.592],
}


def fixture(db, stairs=True, node_tags=None):
    elements = [
        {
            "type": "node",
            "id": n,
            "version": 1,
            "lon": p[0],
            "lat": p[1],
            "tags": (node_tags or {}).get(
                n, {"entrance": "main"} if n in (1, 3) else {}
            ),
        }
        for n, p in POINTS.items()
    ]
    for id_, ids, tags in [
        (10, [1, 2], {}),
        (11, [2, 3], {"highway": "steps"} if stairs else {}),
        (12, [2, 4, 3], {}),
        (13, [5, 6], {}),
    ]:
        elements.append(
            {
                "type": "way",
                "id": id_,
                "version": 1,
                "nodes": ids,
                "tags": {"highway": "footway", **tags},
                "geometry": [{"lon": POINTS[n][0], "lat": POINTS[n][1]} for n in ids],
            }
        )
    raw = json.dumps(
        {"osm3s": {"timestamp_osm_base": "2026-10-13T00:00:00Z"}, "elements": elements}
    ).encode()
    import_snapshot(db, raw, "https://example.test/routing")
    build_graph(db, raw)
    return raw


def endpoint(n):
    return Endpoint(kind="coordinate", longitude=POINTS[n][0], latitude=POINTS[n][1])


def request(a=1, b=3, profile="shortest"):
    return RouteRequest(origin=endpoint(a), destination=endpoint(b), profile=profile)


def osm_paths(db, result):
    return (
        db.execute(
            text("SELECT osm_id FROM geo.features WHERE id=ANY(:ids) ORDER BY osm_id"),
            {"ids": result["properties"]["path_ids"]},
        )
        .scalars()
        .all()
    )


def test_shortest_step_free_and_geometry(db):
    fixture(db)
    shortest = route(db, request())
    stepfree = route(db, request(profile="step_free"))
    assert osm_paths(db, shortest) == [10, 11]
    assert osm_paths(db, stepfree) == [10, 12]
    assert 150 < shortest["properties"]["distance_m"] < 170
    assert stepfree["properties"]["distance_m"] > shortest["properties"]["distance_m"]
    assert shortest["geometry"]["coordinates"][0] == POINTS[1]
    assert shortest["geometry"]["coordinates"][-1] == POINTS[3]
    assert db.execute(
        text("SELECT ST_IsValid(ST_GeomFromGeoJSON(:g))"),
        {"g": json.dumps(shortest["geometry"])},
    ).scalar()
    assert not stepfree["properties"]["path_accessibility_verified"]
    assert route(db, request(profile="walking"))["properties"]["duration_s"] > 0


def test_closures_expiration_and_rebuild_preservation(db):
    raw = fixture(db)
    db.execute(
        text(
            "INSERT INTO geo.path_closures(feature_id,reason,reviewer) SELECT id,'Repair','tester' FROM geo.paths WHERE osm_id=11"
        )
    )
    assert osm_paths(db, route(db, request())) == [10, 12]
    build_graph(db, raw)
    assert osm_paths(db, route(db, request())) == [10, 12]
    db.execute(
        text(
            "UPDATE geo.path_closures SET starts_at=now()-interval '2 days', ends_at=now()-interval '1 day'"
        )
    )
    assert osm_paths(db, route(db, request())) == [10, 11]


def test_disconnected_and_out_of_snap_range(db):
    fixture(db)
    with pytest.raises(HTTPException) as exc:
        route(db, request(b=5))
    assert "No connected route" in exc.value.detail
    with pytest.raises(HTTPException):
        route(
            db,
            RouteRequest(
                origin=Endpoint(kind="coordinate", longitude=-84.75, latitude=43.61),
                destination=endpoint(1),
            ),
        )


def test_reverse_same_point_and_snap_disclosure(db):
    fixture(db)
    reverse = route(db, request(3, 1))
    assert reverse["geometry"]["coordinates"][0] == POINTS[3]
    same = route(db, request(1, 1))
    assert same["properties"]["distance_m"] == 0
    near = route(
        db,
        RouteRequest(
            origin=Endpoint(kind="coordinate", longitude=-84.78001, latitude=43.59),
            destination=endpoint(3),
        ),
    )
    assert near["properties"]["origin"]["gap_m"] > 0
    assert any("Gaps" in w for w in near["properties"]["warnings"])


def test_restricted_paths_one_way_and_barriers(db):
    raw = fixture(db, stairs=False)
    db.execute(
        text(
            "INSERT INTO geo.verifications(feature_id,reviewer,note,tags_override) SELECT id,'tester','Closed','{\"access\":\"private\"}' FROM geo.paths WHERE osm_id=11"
        )
    )
    with pytest.raises(HTTPException) as exc:
        route(db, request())
    assert exc.value.status_code == 503
    build_graph(db, raw)
    assert osm_paths(db, route(db, request())) == [10, 12]
    db.execute(
        text(
            "INSERT INTO geo.verifications(feature_id,reviewer,note,tags_override) SELECT id,'tester','Direction','{\"oneway:foot\":\"yes\"}' FROM geo.paths WHERE osm_id=10"
        )
    )
    build_graph(db, raw)
    with pytest.raises(HTTPException):
        route(db, request(3, 1))


def test_entrances_and_building_without_entrance(db):
    fixture(db)
    id_ = db.execute(text("SELECT id FROM geo.entrances WHERE osm_id=1")).scalar_one()
    result = route(
        db,
        RouteRequest(origin=Endpoint(kind="entrance", id=id_), destination=endpoint(3)),
    )
    assert result["properties"]["origin"]["node"] == 1
    with pytest.raises(HTTPException) as exc:
        route(
            db,
            RouteRequest(
                origin=Endpoint(kind="building", id=id_), destination=endpoint(3)
            ),
        )
    assert exc.value.status_code == 404


def test_invalid_api_inputs_and_no_get_coordinate_logging(db, monkeypatch):
    monkeypatch.setenv("GEO_ROUTING_ENABLED", "true")
    fixture(db)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_geo_db] = lambda: db
    with TestClient(app) as client:
        assert (
            client.post("/api/geo/routes", json=request().model_dump()).status_code
            == 200
        )
        assert client.get("/api/geo/routes").status_code == 405
        for patch in (
            {"profile": "';DROP SCHEMA geo;--"},
            {"origin": {"kind": "coordinate", "longitude": 0, "latitude": 0}},
            {"origin": {"kind": "building", "id": -1}},
            {"origin": {"kind": "building", "id": 1, "longitude": -84.78}},
        ):
            assert (
                client.post(
                    "/api/geo/routes", json={**request().model_dump(), **patch}
                ).status_code
                == 422
            )


def test_source_mismatch_is_not_connected(db):
    raw = fixture(db)
    doc = json.loads(raw)
    doc["elements"] = [
        n for n in doc["elements"] if not (n["type"] == "node" and n["id"] == 2)
    ]
    result = build_graph(db, json.dumps(doc).encode())
    assert result["rejected"]
    with pytest.raises(HTTPException):
        route(db, request())


def test_graph_geometric_crossings_are_disconnected(db):
    doc = {"osm3s": {"timestamp_osm_base": "2026-10-13T00:00:00Z"}, "elements": []}
    coords = {
        1: [-84.78, 43.59],
        2: [-84.778, 43.592],
        3: [-84.78, 43.592],
        4: [-84.778, 43.59],
    }
    for n, p in coords.items():
        doc["elements"].append(
            {"type": "node", "id": n, "version": 1, "lon": p[0], "lat": p[1]}
        )
    for n, ids in [(10, [1, 2]), (11, [3, 4])]:
        doc["elements"].append(
            {
                "type": "way",
                "id": n,
                "version": 1,
                "nodes": ids,
                "tags": {"highway": "footway"},
                "geometry": [{"lon": coords[i][0], "lat": coords[i][1]} for i in ids],
            }
        )
    raw = json.dumps(doc).encode()
    import_snapshot(db, raw, "https://example.test/routing")
    report = build_graph(db, raw)
    assert report["components_before_restrictions"] == 2
    with pytest.raises(HTTPException):
        route(
            db,
            RouteRequest(
                origin=endpoint(1),
                destination=Endpoint(
                    kind="coordinate", longitude=coords[3][0], latitude=coords[3][1]
                ),
            ),
        )


def test_node_barrier_and_bad_settings(db, monkeypatch):
    fixture(db, node_tags={2: {"barrier": "fence"}})
    with pytest.raises(HTTPException):
        route(db, request())
    monkeypatch.setenv("GEO_WALK_SPEED_MPS", "nan")
    with pytest.raises(HTTPException) as exc:
        route(db, request())
    assert exc.value.status_code == 503


def test_building_to_building_and_missing_entrance(db):
    raw = fixture(db)
    for osm_id, node in [(100, 1), (101, 3), (102, 5)]:
        x, y = POINTS[node]
        db.execute(
            text("""INSERT INTO geo.features(kind,osm_type,osm_id,osm_version,source_id,name,geom)
          SELECT 'building','way',:osm,1,id,'Fixture building',ST_MakeEnvelope(:x,:y,:east,:north,4326)
          FROM geo.sources LIMIT 1"""),
            {"osm": osm_id, "x": x, "y": y, "east": x + 0.0001, "north": y + 0.0001},
        )
    build_graph(db, raw)
    ids = dict(db.execute(text("SELECT osm_id,id FROM geo.buildings")).all())
    result = route(
        db,
        RouteRequest(
            origin=Endpoint(kind="building", id=ids[100]),
            destination=Endpoint(kind="building", id=ids[101]),
        ),
    )
    assert result["properties"]["distance_m"] > 100
    assert any("associations" in w for w in result["properties"]["warnings"])
    with pytest.raises(HTTPException) as exc:
        route(
            db,
            RouteRequest(
                origin=Endpoint(kind="building", id=ids[102]), destination=endpoint(1)
            ),
        )
    assert "No connected route" in exc.value.detail


def test_verified_slope_restrictions_and_accessibility(db):
    raw = fixture(db, stairs=False)
    db.execute(
        text("""INSERT INTO geo.verifications(feature_id,reviewer,note,accessibility_verified,tags_override)
      SELECT id,'tester','Slope survey',true,'{"incline":"12%","wheelchair":"yes"}' FROM geo.paths WHERE osm_id=11""")
    )
    build_graph(db, raw)
    assert osm_paths(db, route(db, request(profile="step_free"))) == [10, 12]
    assert not route(db, request(profile="step_free"))["properties"][
        "path_accessibility_verified"
    ]


def test_reviewed_entrance_restriction_blocks_through_route(db):
    raw = fixture(db)
    db.execute(
        text("""INSERT INTO geo.verifications(feature_id,reviewer,note,tags_override)
      SELECT id,'tester','Locked entrance','{"access":"private"}' FROM geo.entrances WHERE osm_id=1""")
    )
    build_graph(db, raw)
    with pytest.raises(HTTPException):
        route(db, request())


def test_route_flag_defaults_off(db, monkeypatch):
    fixture(db)
    monkeypatch.delenv("GEO_ROUTING_ENABLED", raising=False)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_geo_db] = lambda: db
    with TestClient(app) as client:
        assert (
            client.post("/api/geo/routes", json=request().model_dump()).status_code
            == 503
        )


def test_routing_migration_preserves_closures(engine):
    from alembic import command
    from alembic.config import Config
    from pathlib import Path

    config = Config(str(Path(__file__).parents[1] / "geo-alembic.ini"))
    with engine.begin() as c:
        fixture(c)
        c.execute(
            text(
                "INSERT INTO geo.path_closures(feature_id,reason,reviewer) SELECT id,'Repair','tester' FROM geo.paths LIMIT 1"
            )
        )
    try:
        with pytest.raises(RuntimeError, match="Routing closures exist"):
            command.downgrade(config, "geo002")
        with engine.connect() as c:
            assert (
                c.execute(text("SELECT count(*) FROM geo.path_closures")).scalar() == 1
            )
            assert (
                c.execute(
                    text("SELECT count(*) FROM public.messaging_sentinel")
                ).scalar()
                == 1
            )
    finally:
        with engine.begin() as c:
            c.execute(
                text(
                    "TRUNCATE geo.verifications,geo.features,geo.sources RESTART IDENTITY CASCADE"
                )
            )


@pytest.mark.parametrize("node,offset,allowed", [(1, 0, True), (2, 0, False), (1, 0.00003, False)])
def test_unverified_approach_requires_boundary_dead_end(db, node, offset, allowed):
    from app.geospatial.entrance_candidates import entrance_candidates
    raw = fixture(db, node_tags={1: {}, 3: {}})
    x, y = POINTS[node]
    id_ = db.execute(text("""
        INSERT INTO geo.features(kind,osm_type,osm_id,osm_version,source_id,name,geom)
        SELECT 'building','way',100,1,id,'Candidate building',
        ST_MakeEnvelope(:x,:y,:east,:north,4326) FROM geo.sources LIMIT 1 RETURNING id
    """), {"x": x+offset, "y": y+offset, "east": x+0.0001, "north": y+0.0001}).scalar_one()
    build_graph(db, raw)
    candidates = entrance_candidates(db)["features"]
    assert bool(candidates) == allowed
    req = RouteRequest(origin=Endpoint(kind="building", id=id_), destination=endpoint(3))
    if allowed:
        result = route(db, req)
        assert result["properties"]["origin"]["endpoint_type"] == "mapped_approach"
        assert any("not a verified entrance" in w for w in result["properties"]["warnings"])
        db.execute(text("""INSERT INTO geo.path_closures(feature_id,reason,reviewer)
          SELECT id,'Test closure','tester' FROM geo.paths WHERE osm_id=10"""))
        with pytest.raises(HTTPException):
            route(db, req)
    else:
        with pytest.raises(HTTPException) as exc:
            route(db, req)
        assert exc.value.detail.startswith("From:")
