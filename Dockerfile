FROM python:3.14.7-slim-trixie

# Pinned so builds are reproducible; bump alongside the uv version the team uses locally
COPY --from=ghcr.io/astral-sh/uv:0.13.4 /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1

WORKDIR /cats-backend

COPY pyproject.toml uv.lock README.md ./

# Install third-party dependencies first so this layer is cached across code changes
RUN uv export --frozen --no-default-groups --no-emit-project > requirements.txt \
    && uv pip install --system -r requirements.txt

COPY ./back_end/ ./back_end/
RUN uv pip install --system --no-deps .

COPY ./scripts/ ./scripts/
COPY ./data/ ./data/

EXPOSE 8000

CMD ["uvicorn", "cats.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
