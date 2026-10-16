"""Real PostGIS tests; refusal to modify any database except campus_spatial_test."""
import json
import os
from pathlib import Path
import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from app.geospatial.importer import import_snapshot
from app.geospatial.queries import feature_collection, parse_bbox, quality_report
from app.geospatial.database import get_geo_db
from app.routers.geographic import router, DEFAULT_BBOX

URL = os.getenv("SPATIAL_TEST_URL")
pytestmark = pytest.mark.skipif(not URL, reason="Requires isolated real PostGIS SPATIAL_TEST_URL")


def snapshot(version=1):
    points = [[-84.78,43.59],[-84.779,43.59],[-84.779,43.591],[-84.78,43.591],[-84.78,43.59]]
    elements = [{"type":"way","id":10,"version":version,"tags":{"building":"yes","name":"Fixture Hall"},"nodes":[1,2,3,4,1],"geometry":[{"lon":x,"lat":y} for x,y in points]}]
    for id_, node_ids, coords in [(20,[1,2],points[:2]),(21,[2,3],points[1:3])]:
        elements.append({"type":"way","id":id_,"version":version,"nodes":node_ids,"tags":{"highway":"footway"},"geometry":[{"lon":x,"lat":y} for x,y in coords]})
    for id_, point in [(1,points[0]),(2,points[1])]:
        elements.append({"type":"node","id":id_,"version":version,"lon":point[0],"lat":point[1],"tags":{"entrance":"main"} if id_==1 else {}})
    return json.dumps({"osm3s":{"timestamp_osm_base":"2026-10-13T00:00:00Z"},"elements":elements}).encode()


@pytest.fixture(scope="module")
def engine():
    eng = create_engine(URL)
    if eng.url.database != "campus_spatial_test":
        pytest.fail("Refusing tests outside campus_spatial_test")
    os.environ["GEO_DATABASE_URL"] = URL
    with eng.begin() as c:
        c.execute(text("CREATE TABLE IF NOT EXISTS public.messaging_sentinel(id integer PRIMARY KEY)"))
        c.execute(text("INSERT INTO public.messaging_sentinel VALUES(1) ON CONFLICT DO NOTHING"))
    command.upgrade(Config(str(Path(__file__).parents[1]/"geo-alembic.ini")),"head")
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine):
    with engine.connect() as c:
        transaction = c.begin()
        yield c
        transaction.rollback()


def test_versions_and_public_data(db):
    assert db.execute(text("SELECT postgis_version(),pgr_version()")).one()
    assert db.execute(text("SELECT count(*) FROM public.messaging_sentinel")).scalar()==1


def test_idempotency_and_overrides(db):
    assert import_snapshot(db,snapshot(),"https://example.test/osm")["changed"]==5
    assert import_snapshot(db,snapshot(),"https://example.test/osm")["changed"]==0
    db.execute(text("INSERT INTO geo.verifications(feature_id,reviewer,note,name_override) SELECT id,'operator','Inspection','Verified Hall' FROM geo.buildings"))
    assert import_snapshot(db,snapshot(2),"https://example.test/osm")["changed"]==5
    assert db.execute(text("SELECT effective_name FROM geo.buildings")).scalar()=="Verified Hall"
    assert import_snapshot(db,snapshot(),"https://example.test/osm")["changed"]==0
    assert db.execute(text("SELECT count(*) FROM geo.sources")).scalar()==2


def test_spatial_queries_and_boundaries(db):
    import_snapshot(db,snapshot(),"https://example.test/osm")
    result=feature_collection(db,parse_bbox(DEFAULT_BBOX),"path",limit=1)
    assert result["next_after"] and 50<result["features"][0]["properties"]["length_m"]<150
    assert not feature_collection(db,parse_bbox("-84.75,43.60,-84.741,43.61"))["features"]
    for bbox in ("nan,43.58,-84.77,43.59","-84.7,43.58,-84.8,43.59","-85,43,-84,44","bad"):
        with pytest.raises(HTTPException):
            parse_bbox(bbox)


def test_invalid_geometry(db):
    doc=json.loads(snapshot())
    points=[[-84.78,43.59],[-84.779,43.591],[-84.779,43.59],[-84.78,43.591],[-84.78,43.59]]
    doc["elements"][0]["geometry"]=[{"lon":x,"lat":y} for x,y in points]
    result=import_snapshot(db,json.dumps(doc).encode(),"https://example.test/osm")
    assert any("Invalid" in x["reason"] for x in result["rejected"])
    assert db.execute(text("SELECT count(*) FROM geo.buildings")).scalar()==0
    doc["elements"][0]["geometry"][0]["lon"]=100
    assert import_snapshot(db,json.dumps(doc).encode(),"https://example.test/osm")["rejected"]


def test_duplicates_and_connectivity(db):
    doc=json.loads(snapshot())
    doc["elements"].append(dict(doc["elements"][1],id=22))
    import_snapshot(db,json.dumps(doc).encode(),"https://example.test/osm")
    checks=quality_report(db)["checks"]
    assert checks["duplicate_paths"] and checks["missing_accessibility"]
    assert not checks["unconnected_paths"] and not checks["missing_entrances"]


def test_http_and_no_write_surface(db):
    import_snapshot(db,snapshot(),"https://example.test/osm")
    app=FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_geo_db]=lambda: db
    with TestClient(app) as client:
        r=client.get("/api/geo/buildings")
        assert r.status_code==200
        id_=r.json()["features"][0]["id"]
        assert client.get(f"/api/geo/buildings/{id_}").status_code==200
        assert len(client.get(f"/api/geo/buildings/{id_}/entrances").json()["features"])==1
        assert client.get("/api/geo/buildings/999999").status_code==404
        assert client.get("/api/geo/features?limit=501").status_code==422
        assert client.post("/api/geo/buildings",json={}).status_code==405


def test_rollback_guard(engine):
    cfg=Config(str(Path(__file__).parents[1]/"geo-alembic.ini"))
    with engine.begin() as c:
        import_snapshot(c,snapshot(),"https://example.test/osm")
    with pytest.raises(RuntimeError,match="Geographic records exist"):
        command.downgrade(cfg,"base")
    with engine.begin() as c:
        c.execute(text("TRUNCATE geo.verifications,geo.features,geo.sources RESTART IDENTITY CASCADE"))
    command.downgrade(cfg,"base")
    with engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM public.messaging_sentinel")).scalar()==1
    command.upgrade(cfg,"head")


def test_overrides_preserve_geometry_and_validate_type(db):
    from sqlalchemy.exc import DBAPIError
    import_snapshot(db,snapshot(),"https://example.test/osm")
    id_=db.execute(text("SELECT id FROM geo.entrances LIMIT 1")).scalar()
    db.execute(text("INSERT INTO geo.verifications(feature_id,reviewer,note,geom_override) VALUES(:id,'operator','Survey',ST_SetSRID(ST_Point(-84.78001,43.59),4326))"),{"id":id_})
    import_snapshot(db,snapshot(2),"https://example.test/osm")
    assert db.execute(text("SELECT ST_X(geom) FROM geo.entrances WHERE id=:id"),{"id":id_}).scalar()==-84.78001
    with pytest.raises(DBAPIError):
        with db.begin_nested():
            db.execute(text("INSERT INTO geo.verifications(feature_id,reviewer,note,geom_override) VALUES(:id,'operator','Invalid',ST_SetSRID(ST_Point(0,0),4326))"),{"id":id_})


def test_crossings_do_not_connect_paths(db):
    doc=json.loads(snapshot())
    doc["elements"]=[{"type":"way","id":20,"version":1,"nodes":[100,101],"tags":{"highway":"footway"},"geometry":[{"lon":-84.78,"lat":43.59},{"lon":-84.778,"lat":43.592}]},
                     {"type":"way","id":21,"version":1,"nodes":[102,103],"tags":{"highway":"footway"},"geometry":[{"lon":-84.78,"lat":43.592},{"lon":-84.778,"lat":43.59}]}]
    import_snapshot(db,json.dumps(doc).encode(),"https://example.test/osm")
    checks=quality_report(db)["checks"]
    assert len(checks["unexpected_crossings"])==1 and len(checks["unconnected_paths"])==2
    assert db.execute(text("SELECT count(*) FROM geo.intersections")).scalar()==0


def test_disabled_data_api(monkeypatch):
    from app.geospatial.database import spatial_engine
    monkeypatch.delenv("GEO_DATA_ENABLED",raising=False)
    spatial_engine.cache_clear()
    app=FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        assert client.get("/api/geo/buildings").status_code==503
    spatial_engine.cache_clear()


def test_xml_consumption_and_entity_rejection(db):
    xml=b'<osm><node id="1" version="2" lon="-84.78" lat="43.59"><tag k="entrance" v="main"/></node></osm>'
    result=import_snapshot(db,xml,"https://example.test/osm","2026-10-13T00:00:00Z")
    assert result["changed"]==1
    with pytest.raises(ValueError,match="timestamp"):
        import_snapshot(db,xml,"https://example.test/osm")
    with pytest.raises(ValueError,match="entities"):
        import_snapshot(db,b'<!DOCTYPE x><osm/>',"https://example.test/osm","2026-10-13T00:00:00Z")


def test_geometry_type_and_srid_constraints(db):
    from sqlalchemy.exc import DBAPIError
    import_snapshot(db,snapshot(),"https://example.test/osm")
    for sql in ("UPDATE geo.features SET geom=ST_SetSRID(ST_Point(-84.78,43.59),4326) WHERE kind='building'",
                "UPDATE geo.features SET geom=ST_SetSRID(geom,3857)"):
        with pytest.raises(DBAPIError):
            with db.begin_nested():
                db.execute(text(sql))


def test_building_search_exact_partial_case_and_literal_wildcards(db):
    from app.geospatial.search import search_buildings
    import_snapshot(db,snapshot(),"https://example.test/osm")
    for query in ('Fixture Hall', 'FIXTURE HALL', 'xture', '  fixture  '):
        assert len(search_buildings(db,query)['results'])==1
    for query in ('', ' ', 'x', '%_', "' OR true --"):
        assert search_buildings(db,query)['results']==[]
    for query in ('x'*121,'hall\x00'):
        with pytest.raises(HTTPException):
            search_buildings(db,query)


def test_reviewed_aliases_rank_and_survive_import(db):
    from app.geospatial.search import search_buildings
    import_snapshot(db,snapshot(),"https://example.test/osm")
    id_=db.execute(text("SELECT id FROM geo.buildings")).scalar_one()
    db.execute(text("INSERT INTO geo.building_aliases(building_id,label,kind,reviewer,note) VALUES(:id,'FH','abbreviation','tester','Verified fixture'),(:id,'Former Hall','alias','tester','Verified fixture')"),{'id':id_})
    assert search_buildings(db,'fh')['results'][0]['id']==id_
    assert search_buildings(db,'former')['results'][0]['match_kind']=='alias'
    import_snapshot(db,snapshot(2),"https://example.test/osm")
    assert search_buildings(db,'fh')['results'][0]['id']==id_
    db.execute(text("INSERT INTO geo.verifications(feature_id,reviewer,note,name_override) VALUES(:id,'tester','Correction','Corrected Hall')"),{'id':id_})
    assert search_buildings(db,'corrected')['results'][0]['id']==id_
    assert not search_buildings(db,'fixture')['results']


def test_duplicate_names_large_results_and_exact_ranking(db):
    from app.geospatial.search import search_buildings
    doc=json.loads(snapshot())
    base=doc['elements'][0]
    doc['elements']=[dict(base,id=100+n,tags={'building':'yes','name': 'Hall' if n==39 else 'Hall Annex'}) for n in range(40)]
    import_snapshot(db,json.dumps(doc).encode(),'https://example.test/osm')
    result=search_buildings(db,'hall',20)
    assert len(result['results'])==20 and result['has_more']
    assert result['results'][0]['name']=='Hall'
    assert len({row['id'] for row in result['results']})==20
    assert result==search_buildings(db,'hall',20)


def test_verified_entrance_and_accessibility_are_independent(db):
    import_snapshot(db,snapshot(),'https://example.test/osm')
    building_id=db.execute(text('SELECT id FROM geo.buildings')).scalar_one()
    entrance_id=db.execute(text('SELECT id FROM geo.entrances')).scalar_one()
    db.execute(text("INSERT INTO geo.verifications(feature_id,reviewer,note,name_override) VALUES(:id,'tester','Name review','Front door')"),{'id':entrance_id})
    result=feature_collection(db,parse_bbox(DEFAULT_BBOX),'entrance',building_id=building_id)['features'][0]
    assert result['properties']['verified'] and not result['properties']['accessibility_verified']
    assert not result['properties']['association_verified']
    db.execute(text("INSERT INTO geo.building_entrances(building_id,entrance_id,reviewer,note) VALUES(:b,:e,'tester','Survey')"),{'b':building_id,'e':entrance_id})
    db.execute(text("INSERT INTO geo.verifications(feature_id,reviewer,note,accessibility_verified,tags_override) VALUES(:e,'tester','Survey',true,'{\"wheelchair\":\"yes\"}')"),{'e':entrance_id})
    result=feature_collection(db,parse_bbox(DEFAULT_BBOX),'entrance',building_id=building_id)['features'][0]
    assert result['properties']['accessibility_verified'] and result['properties']['association_verified']


def test_http_search_and_missing_metadata(db):
    doc=json.loads(snapshot())
    doc['elements'][0]['tags']={'building':'yes'}
    import_snapshot(db,json.dumps(doc).encode(),'https://example.test/osm')
    id_=db.execute(text('SELECT id FROM geo.buildings')).scalar_one()
    app=FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_geo_db]=lambda:db
    with TestClient(app) as client:
        assert client.get('/api/geo/buildings/search?q=hall').json()['results']==[]
        detail=client.get(f'/api/geo/buildings/{id_}').json()
        assert detail['properties']['name'] is None and detail['properties']['aliases']==[]
        assert client.get('/api/geo/buildings/search?q=hall&limit=31').status_code==422
        assert client.get('/api/geo/buildings/search?q='+('a'*121)).status_code==422
        assert client.post('/api/geo/buildings/search',json={}).status_code==405


def test_search_migration_protects_reviewed_records(engine):
    cfg=Config(str(Path(__file__).parents[1]/'geo-alembic.ini'))
    with engine.begin() as c:
        import_snapshot(c,snapshot(),'https://example.test/osm')
        c.execute(text("INSERT INTO geo.building_aliases(building_id,label,kind,reviewer,note) SELECT id,'FH','abbreviation','tester','Test verification' FROM geo.buildings"))
    with pytest.raises(RuntimeError,match='Reviewed geographic data exists'):
        command.downgrade(cfg,'geo001')
    with engine.begin() as c:
        assert c.execute(text('SELECT count(*) FROM geo.building_aliases')).scalar()==1
        assert c.execute(text('SELECT version_num FROM geo_alembic_version')).scalar()=='geo004'
        c.execute(text('DELETE FROM geo.building_aliases'))
        c.execute(text('TRUNCATE geo.verifications,geo.features,geo.sources RESTART IDENTITY CASCADE'))


def test_alias_and_entrance_reference_types(db):
    from sqlalchemy.exc import DBAPIError
    import_snapshot(db,snapshot(),'https://example.test/osm')
    entrance=db.execute(text('SELECT id FROM geo.entrances')).scalar_one()
    with pytest.raises(DBAPIError):
        with db.begin_nested():
            db.execute(text("INSERT INTO geo.building_aliases(building_id,label,kind,reviewer,note) VALUES(:id,'AB','abbreviation','tester','Wrong feature type')"),{'id':entrance})
