# Isolated local spatial testing; never mount an existing messaging data volume.
FROM postgres:17-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-17-postgis-3 postgresql-17-postgis-3-scripts postgresql-17-pgrouting \
    && rm -rf /var/lib/apt/lists/*
