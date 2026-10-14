FROM ghcr.io/astral-sh/uv:0.13.0 AS uv
FROM python:3.14-slim-bookworm
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --locked --no-dev
COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/alembic.ini ./
RUN useradd --uid 10001 --create-home campus && mkdir -p /app/.data/avatars && chown -R campus:campus /app/.data
USER campus
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-proxy-headers"]
