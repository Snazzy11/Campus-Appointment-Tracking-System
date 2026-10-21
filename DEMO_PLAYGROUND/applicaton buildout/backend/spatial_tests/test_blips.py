# ruff: noqa: F811
"""Stage 5 against isolated PostGIS; all report changes roll back per test."""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi import HTTPException, FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import text
from types import SimpleNamespace
from app.geospatial.blips import (
    Submission,
    Moderation,
    RoleGrant,
    submit,
    moderate,
    reports,
    grant_role,
)
from app.geospatial.routing import route
from app.geospatial.graph import build_graph
from app.routers.blips import router
from app.routers.profiles import editable_user
from app.geospatial.database import get_blip_db
from spatial_tests.test_spatial import engine, db, URL  # noqa: F401
from spatial_tests.test_routing import fixture, request, osm_paths

pytestmark = pytest.mark.skipif(not URL, reason="Requires isolated PostGIS")


def payload(**patch):
    return Submission(
        category="hazard",
        description="Ice covers the walkway",
        longitude=-84.7795,
        latitude=43.59,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        **patch,
    )


def reviewer(db):
    db.execute(text("INSERT INTO geo.blip_roles VALUES(2,'moderator'),(3,'admin')"))


def change(db, id_, action, **kw):
    return moderate(
        db, 2, id_, Moderation(action=action, note="Observed by campus staff", **kw)
    )


def test_lifecycle_expiry_and_public_privacy(db):
    reviewer(db)
    id_ = submit(db, 1, payload())["id"]
    assert not reports(db)["features"]
    assert reports(db, 1, "mine")["features"][0]["properties"]["status"] == "pending"
    change(db, id_, "approve")
    change(db, id_, "activate")
    p = reports(db)["features"][0]["properties"]
    assert "author_id" not in p and not p["verified"]
    # Advance report timestamps while preserving database lifetime constraints.
    db.execute(
        text(
            "UPDATE geo.blips SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE id=:id"
        ),
        {"id": id_},
    )
    assert not reports(db)["features"]
    assert reports(db, 1, "mine")["features"][0]["properties"]["status"] == "expired"
    with pytest.raises(HTTPException):
        change(db, id_, "activate")
    change(db, id_, "resolve")
    assert db.execute(text("SELECT count(*) FROM geo.blip_audit")).scalar() == 4


def test_permissions_and_role_grants(db):
    reviewer(db)
    id_ = submit(db, 1, payload())["id"]
    with pytest.raises(HTTPException) as exc:
        moderate(db, 1, id_, Moderation(action="approve", note="Cannot approve this"))
    assert exc.value.status_code == 403
    with pytest.raises(HTTPException):
        reports(db, 1, "queue")
    with pytest.raises(HTTPException):
        grant_role(
            db, 2, RoleGrant(user_id=1, role="moderator", note="Unprivileged grant")
        )
    grant_role(
        db, 3, RoleGrant(user_id=1, role="moderator", note="Test moderator assignment")
    )
    assert reports(db, 1, "queue")["features"]
    grant_role(db, 3, RoleGrant(user_id=1, role="user", note="Test moderator removal"))
    with pytest.raises(HTTPException):
        reports(db, 1, "queue")
    with pytest.raises(HTTPException):
        grant_role(
            db, 3, RoleGrant(user_id=3, role="user", note="Must protect administrators")
        )


def test_duplicate_and_database_rate_limit(db):
    submit(db, 1, payload())
    with pytest.raises(HTTPException) as exc:
        submit(db, 1, payload())
    assert exc.value.status_code == 409
    for i in range(4):
        p = payload()
        p.longitude += (i + 1) * 0.001
        submit(db, 1, p)
    p = payload()
    p.longitude -= 0.003
    with pytest.raises(HTTPException) as exc:
        submit(db, 1, p)
    assert exc.value.status_code == 429
    assert submit(db, 2, p)["status"] == "pending"


@pytest.mark.parametrize(
    "patch",
    [
        {"longitude": float("nan")},
        {"latitude": 0},
        {"description": "   short "},
        {"expires_at": datetime.now()},
        {"expires_at": datetime.now(timezone.utc) - timedelta(hours=1)},
        {"author_id": 9},
        {"verified": True},
        {"category": "';DROP TABLE blips;"},
    ],
)
def test_invalid_and_forged_input(patch):
    values = payload().model_dump()
    with pytest.raises(ValidationError):
        Submission(**{**values, **patch})


def test_route_impact_requires_activation_verification_and_explicit_edges(db):
    raw = fixture(db)
    reviewer(db)
    baseline = osm_paths(db, route(db, request()))
    id_ = submit(db, 1, payload())["id"]
    edges = (
        db.execute(
            text(
                "SELECT id FROM geo.routing_edges WHERE feature_id IN (SELECT id FROM geo.paths WHERE osm_id=11)"
            )
        )
        .scalars()
        .all()
    )
    assert osm_paths(db, route(db, request())) == baseline
    with pytest.raises(HTTPException):
        change(db, id_, "activate", verified=True, edge_ids=edges)
    change(db, id_, "approve")
    with pytest.raises(HTTPException):
        change(db, id_, "activate", edge_ids=edges)
    with pytest.raises(HTTPException):
        change(db, id_, "activate", verified=True, edge_ids=[999999])
    change(db, id_, "activate", verified=True, edge_ids=edges)
    assert osm_paths(db, route(db, request())) == [10, 12]
    build_graph(db, raw)
    assert osm_paths(db, route(db, request())) == [10, 12]
    change(db, id_, "resolve")
    assert osm_paths(db, route(db, request())) == baseline


def test_unverified_markers_never_close_paths_and_rejected_is_terminal(db):
    fixture(db)
    reviewer(db)
    baseline = osm_paths(db, route(db, request()))
    id_ = submit(db, 1, payload())["id"]
    change(db, id_, "approve")
    change(db, id_, "activate")
    assert osm_paths(db, route(db, request())) == baseline
    id2 = submit(db, 2, payload())["id"]
    change(db, id2, "reject")
    with pytest.raises(HTTPException):
        change(db, id2, "approve")


def test_http_boundaries(db):
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_blip_db] = lambda: db
    app.dependency_overrides[editable_user] = lambda: SimpleNamespace(id=1)
    with TestClient(app) as client:
        assert (
            client.post(
                "/api/geo/reports", json=payload().model_dump(mode="json")
            ).status_code
            == 201
        )
        assert client.get("/api/geo/reports/private?scope=queue").status_code == 403
        assert client.get("/api/geo/reports/private?scope=other").status_code == 422
        assert client.get("/api/geo/reports?after=-1").status_code == 422
        assert client.get("/api/geo/reports").headers["cache-control"] == "no-store"
        assert (
            client.post(
                "/api/geo/reports",
                json={**payload().model_dump(mode="json"), "status": "active"},
            ).status_code
            == 422
        )
    app.dependency_overrides.pop(editable_user)
    with TestClient(app) as client:
        assert (
            client.post(
                "/api/geo/reports", json=payload().model_dump(mode="json")
            ).status_code
            == 401
        )


def test_expired_closure_restores_route_and_far_segments_rejected(db):
    fixture(db)
    reviewer(db)
    baseline = osm_paths(db, route(db, request()))
    id_ = submit(db, 1, payload())["id"]
    change(db, id_, "approve")
    far = (
        db.execute(
            text(
                "SELECT id FROM geo.routing_edges WHERE feature_id IN (SELECT id FROM geo.paths WHERE osm_id=13)"
            )
        )
        .scalars()
        .all()
    )
    with pytest.raises(HTTPException) as exc:
        change(db, id_, "activate", verified=True, edge_ids=far)
    assert exc.value.status_code == 422
    near = (
        db.execute(
            text(
                "SELECT id FROM geo.routing_edges WHERE feature_id IN (SELECT id FROM geo.paths WHERE osm_id=11)"
            )
        )
        .scalars()
        .all()
    )
    change(db, id_, "activate", verified=True, edge_ids=near)
    assert osm_paths(db, route(db, request())) != baseline
    db.execute(
        text(
            "UPDATE geo.blips SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE id=:id"
        ),
        {"id": id_},
    )
    assert osm_paths(db, route(db, request())) == baseline


def test_malicious_description_is_stored_as_text_and_invalid_edge_lists_rejected(db):
    p = payload()
    p.description = "<script>alert('example')</script>"
    submit(db, 1, p)
    assert (
        reports(db, 1, "mine")["features"][0]["properties"]["description"]
        == p.description
    )
    for ids in [[1, 1], [-1], [2**64], list(range(1, 32))]:
        with pytest.raises(ValidationError):
            Moderation(
                action="activate",
                note="Test malformed paths",
                verified=True,
                edge_ids=ids,
            )


def test_high_risk_nearby_paths_are_measured_and_explicitly_verified(db):
    from app.routers.blips import paths

    fixture(db)
    reviewer(db)
    baseline = osm_paths(db, route(db, request()))
    id_ = submit(db, 1, payload(severity="high"))["id"]
    candidates = paths(id_=id_, user=SimpleNamespace(id=2), db=db)
    distances = [float(p["distance_m"]) for p in candidates]
    assert distances == sorted(distances)
    assert all(0 <= d <= 50 for d in distances)
    selected = [p["id"] for p in candidates if p["distance_m"] <= 10]
    assert selected
    assert osm_paths(db, route(db, request())) == baseline
    change(db, id_, "approve")
    with pytest.raises(HTTPException):
        change(db, id_, "activate", edge_ids=selected)
    change(db, id_, "activate", verified=True, edge_ids=selected)
    try:
        assert osm_paths(db, route(db, request())) != baseline
    except HTTPException as exc:
        assert exc.status_code == 422
    change(db, id_, "resolve")
    assert osm_paths(db, route(db, request())) == baseline
