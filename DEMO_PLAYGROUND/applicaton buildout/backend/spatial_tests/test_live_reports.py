# ruff: noqa: F811
import asyncio
import json
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import text
from app.geospatial.live import snapshot, frames
from app.geospatial.blips import submit, moderate, Submission, Moderation
from spatial_tests.test_spatial import engine, db, URL  # noqa: F401

pytestmark = pytest.mark.skipif(not URL, reason="Requires isolated PostGIS")


def test_snapshot_visibility_changes_and_expiration(db):
    db.execute(text("INSERT INTO geo.blip_roles VALUES(2,'moderator')"))
    initial = snapshot(db)
    p = Submission(
        category="hazard",
        description="A long report description",
        longitude=-84.78,
        latitude=43.59,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
    )
    id_ = submit(db, 1, p)["id"]
    assert snapshot(db) == initial  # Pending reports never leak publicly.
    assert len(json.loads(snapshot(db, 2, "queue")[1])["reports"]["features"]) == 1
    for action in ("approve", "activate"):
        moderate(db, 2, id_, Moderation(action=action, note="Reviewed on campus"))
    published = snapshot(db)
    assert published != initial
    assert (
        json.loads(published[1])["routing_version"]
        == json.loads(initial[1])["routing_version"]
    )
    db.execute(
        text(
            "UPDATE geo.blips SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour'"
        )
    )
    assert snapshot(db) == initial


class Request:
    disconnected = False

    async def is_disconnected(self):
        return self.disconnected


def test_reconnect_multiclient_duplicates_revocation_and_cleanup():
    async def exercise():
        first = ("1", '{"reports":{}}')
        changed = ("2", '{"reports":{"updated":true}}')
        req = Request()
        a = frames(req, first, lambda: changed, interval=0)
        b = frames(req, first, lambda: changed, interval=0)
        assert "id: 1" in await anext(a)
        assert "id: 1" in await anext(b)
        assert "id: 2" in await anext(a)
        assert "id: 2" in await anext(b)
        # Duplicate snapshots are suppressed; a heartbeat eventually arrives.
        assert "keepalive" in await anext(a)
        await a.aclose()
        await b.aclose()
        reconnect = frames(req, changed, lambda: changed, interval=0)
        assert "id: 2" in await anext(reconnect)
        await reconnect.aclose()
        revoked = frames(req, first, lambda: first, permitted=lambda: False, interval=0)
        assert "access_revoked" in await anext(revoked)
        with pytest.raises(StopAsyncIteration):
            await anext(revoked)
        req.disconnected = True
        closed = frames(req, first, lambda: first, interval=0)
        with pytest.raises(StopAsyncIteration):
            await anext(closed)

    asyncio.run(exercise())


def test_stream_database_failure_is_sanitized():
    async def exercise():
        def fail():
            raise RuntimeError("secret SQL details")

        stream = frames(Request(), ("1", "{}"), fail, interval=0)
        await anext(stream)
        failure = await anext(stream)
        assert "map_unavailable" in failure and "secret" not in failure
        await stream.aclose()

    asyncio.run(exercise())


def test_independent_processes_recover_committed_state_after_restart(engine):
    import os
    import subprocess
    import sys

    code = """from sqlalchemy import create_engine
from app.geospatial.live import snapshot
import os
with create_engine(os.environ['SPATIAL_TEST_URL']).begin() as c:
 print(snapshot(c)[0])
"""

    def read():
        return subprocess.check_output(
            [sys.executable, "-c", code], env=os.environ, text=True
        ).strip()

    before = read()
    id_ = None
    try:
        with engine.begin() as c:
            c.execute(text("INSERT INTO geo.blip_roles VALUES(2000000000,'moderator')"))
            id_ = submit(
                c,
                2000000000,
                Submission(
                    category="hazard",
                    description="Cross-worker fixture only",
                    longitude=-84.78,
                    latitude=43.59,
                    expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                ),
            )["id"]
            for action in ("approve", "activate"):
                moderate(
                    c,
                    2000000000,
                    id_,
                    Moderation(action=action, note="Automated fixture review"),
                )
        worker_a, worker_b = read(), read()
        assert worker_a == worker_b and worker_a != before
        assert read() == worker_a  # New process, no shared Python event/session memory.
    finally:
        with engine.begin() as c:
            c.execute(text("DELETE FROM geo.blip_audit WHERE actor_id=2000000000"))
            if id_:
                c.execute(text("DELETE FROM geo.blips WHERE id=:id"), {"id": id_})
            c.execute(text("DELETE FROM geo.blip_roles WHERE user_id=2000000000"))


def test_two_http_workers_and_restart_recover_authoritative_reports(engine):
    import os
    import socket
    import subprocess
    import sys
    import time
    import httpx

    assert engine.url.database == "campus_spatial_test"
    sockets = [socket.socket(), socket.socket()]
    for sock in sockets:
        sock.bind(("127.0.0.1", 0))
    ports = [sock.getsockname()[1] for sock in sockets]
    for sock in sockets:
        sock.close()
    env = {
        **os.environ,
        "GEO_REPORTS_ENABLED": "true",
        "GEO_REPORT_DATABASE_URL": engine.url.render_as_string(hide_password=False),
    }
    processes = []

    def start(port):
        p = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        processes.append(p)
        for _ in range(60):
            try:
                if (
                    httpx.get(
                        f"http://127.0.0.1:{port}/api/health", timeout=1
                    ).status_code
                    == 200
                ):
                    return
            except httpx.TransportError:
                pass
            time.sleep(0.1)
        raise AssertionError("Test worker did not start")

    def event(lines):
        for line in lines:
            if line.startswith("data: "):
                return json.loads(line[6:])
        raise AssertionError("Stream ended before snapshot")

    id_ = None
    try:
        for port in ports:
            start(port)
        urls = [f"http://127.0.0.1:{p}/api/geo/reports/stream" for p in ports]
        assert (
            httpx.get(
                f"http://127.0.0.1:{ports[0]}/api/geo/reports/private/stream"
            ).status_code
            == 401
        )
        with (
            httpx.stream("GET", urls[0], timeout=10) as a,
            httpx.stream("GET", urls[1], timeout=10) as b,
        ):
            assert a.status_code == b.status_code == 200
            ai, bi = a.iter_lines(), b.iter_lines()
            assert event(ai) == event(bi)
            with engine.begin() as c:
                c.execute(
                    text("INSERT INTO geo.blip_roles VALUES(1999999999,'moderator')")
                )
                id_ = submit(
                    c,
                    1999999999,
                    Submission(
                        category="hazard",
                        description="HTTP cross-worker fixture",
                        longitude=-84.78,
                        latitude=43.59,
                        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                    ),
                )["id"]
                for action in ("approve", "activate"):
                    moderate(
                        c,
                        1999999999,
                        id_,
                        Moderation(action=action, note="Test fixture activation"),
                    )
            latest = event(ai)
            assert latest == event(bi)
            assert any(f["id"] == id_ for f in latest["reports"]["features"])
        processes[0].terminate()
        processes[0].wait(timeout=5)
        start(ports[0])
        with httpx.stream("GET", urls[0], timeout=10) as restarted:
            assert event(restarted.iter_lines()) == latest
    finally:
        for p in processes:
            if p.poll() is None:
                p.terminate()
                p.wait(timeout=5)
        with engine.begin() as c:
            c.execute(text("DELETE FROM geo.blip_audit WHERE actor_id=1999999999"))
            if id_:
                c.execute(text("DELETE FROM geo.blips WHERE id=:id"), {"id": id_})
            c.execute(text("DELETE FROM geo.blip_roles WHERE user_id=1999999999"))
