"""Durable-state SSE: short PostgreSQL snapshots, no in-memory event bus."""

import asyncio
import hashlib
import json
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy import text
from starlette.concurrency import run_in_threadpool
from .database import blip_engine
from .blips import reports
from ..services.sessions import get_session


def snapshot(db, user_id=None, scope="public"):
    data = reports(db, user_id, scope)
    closures = db.execute(
        text("""
      SELECT 'report' AS kind,be.feature_id,be.source,be.target,br.id
      FROM geo.blip_edges be JOIN geo.blips br ON br.id=be.blip_id
      WHERE br.status='active' AND br.verified AND br.expires_at>now()
      UNION ALL
      SELECT 'operator',feature_id,0,0,id FROM geo.path_closures
      WHERE starts_at<=now() AND (ends_at IS NULL OR ends_at>now())
      ORDER BY 1,2,3,4,5
    """)
    ).all()
    graph = db.execute(
        text("SELECT dirty,built_at,source_sha256 FROM geo.routing_state")
    ).all()
    routing = hashlib.sha256(repr((closures, graph)).encode()).hexdigest()
    payload = {"reports": data, "routing_version": routing}
    serialized = json.dumps(jsonable_encoder(payload), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode()).hexdigest(), serialized


def read_snapshot(user_id=None, scope="public"):
    with (
        blip_engine()
        .connect()
        .execution_options(isolation_level="REPEATABLE READ") as db
    ):
        with db.begin():
            db.execute(text("SET TRANSACTION READ ONLY"))
            db.execute(text("SET LOCAL statement_timeout='3000ms'"))
            return snapshot(db, user_id, scope)


async def frames(request, first, read, permitted=lambda: True, interval=2):
    previous = None
    current = first
    ticks = 0
    try:
        while not await request.is_disconnected():
            if not permitted():
                yield "event: access_revoked\ndata: {}\n\n"
                return
            version, data = current
            if version != previous:
                yield f"id: {version}\nevent: map_snapshot\ndata: {data}\n\n"
                previous = version
            elif ticks % 5 == 0:
                yield ": keepalive\n\n"
            ticks += 1
            await asyncio.sleep(interval)
            if await request.is_disconnected():
                return
            current = await run_in_threadpool(read)
    except asyncio.CancelledError:
        raise
    except HTTPException as exc:
        event = "access_revoked" if exc.status_code in (401, 403) else "map_unavailable"
        yield f"event: {event}\ndata: {{}}\n\n"
    except Exception:
        # Never serialize SQL, coordinates or authentication details into errors.
        yield "event: map_unavailable\ndata: {}\n\n"


async def response(request, user_id=None, scope="public", session_id=None):
    def read():
        return read_snapshot(user_id, scope)

    try:
        first = await run_in_threadpool(read)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            503, "Live campus updates are temporarily unavailable"
        ) from None
    permitted = (
        (lambda: get_session(session_id) is not None) if user_id else (lambda: True)
    )
    return StreamingResponse(
        frames(request, first, read, permitted),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
