"""Literal case-insensitive substring search over names and operator-reviewed aliases."""
import re
from fastapi import HTTPException
from sqlalchemy import text


def search_buildings(connection, query, limit=20):
    if len(query) > 120 or any(ord(c) < 32 for c in query):
        raise HTTPException(422, "Search must be at most 120 characters without control characters")
    query = re.sub(r"\s+", " ", query).strip().lower()
    if len(query) < 2:
        return {"results": [], "has_more": False}
    literal = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    rows = connection.execute(text("""WITH candidates AS (
      SELECT DISTINCT ON (building_id) building_id,term,kind,
        CASE WHEN normalized=:q THEN 0 WHEN normalized LIKE :prefix ESCAPE '\\' THEN 1 ELSE 2 END AS rank
      FROM geo.building_search_terms WHERE normalized LIKE :contains ESCAPE '\\'
      ORDER BY building_id,rank,CASE WHEN kind='name' THEN 0 ELSE 1 END,term
    ) SELECT b.id,coalesce(nullif(b.effective_name,''),'Unnamed building') AS name,
        c.term AS matched_term,c.kind AS match_kind,
        b.effective_tags->>'addr:street' AS street,b.effective_tags->>'addr:housenumber' AS house_number,
        ST_X(ST_PointOnSurface(b.geom)) AS longitude,ST_Y(ST_PointOnSurface(b.geom)) AS latitude
      FROM candidates c JOIN geo.buildings b ON b.id=c.building_id
      ORDER BY c.rank,lower(coalesce(b.effective_name,'')),b.id LIMIT :limit"""),
      {"q": query, "prefix": literal+"%", "contains": "%"+literal+"%", "limit": limit+1}).mappings().all()
    return {"results": [dict(row) for row in rows[:limit]], "has_more": len(rows)>limit}
