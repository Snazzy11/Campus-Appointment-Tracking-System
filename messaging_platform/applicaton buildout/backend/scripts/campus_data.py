"""Explicit operator tool: import an OSM snapshot or report spatial data quality."""
import argparse
import json
import os
from pathlib import Path
from sqlalchemy import create_engine, text
from app.geospatial.importer import import_snapshot
from app.geospatial.queries import quality_report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("import", "validate", "build-graph", "entrance-candidates"))
    parser.add_argument("--snapshot", type=Path)
    parser.add_argument("--source-url", default="https://overpass-api.de/api/interpreter")
    parser.add_argument("--captured-at", help="Required for XML extracts; UTC retrieval timestamp")
    args = parser.parse_args()
    if not os.getenv("GEO_DATABASE_URL"):
        parser.error("GEO_DATABASE_URL must be explicit")
    with create_engine(os.environ["GEO_DATABASE_URL"]).begin() as connection:
        connection.execute(text("SET LOCAL statement_timeout='60s'"))
        if args.command in ("import", "build-graph"):
            if not args.snapshot or args.snapshot.stat().st_size > 20_000_000:
                parser.error("Provide --snapshot, maximum 20 MB")
            if args.command == "import":
                result = import_snapshot(connection, args.snapshot.read_bytes(), args.source_url, args.captured_at)
            else:
                from app.geospatial.graph import build_graph
                result = build_graph(connection, args.snapshot.read_bytes(), args.captured_at)
        elif args.command == "entrance-candidates":
            from app.geospatial.entrance_candidates import entrance_candidates
            result = entrance_candidates(connection)
        else:
            result = quality_report(connection)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
