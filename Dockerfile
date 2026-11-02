FROM python:3.14.7-slim-trixie

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1

WORKDIR /cats-backend

RUN apt-get update && apt-get install -y --no-install-recommends file \
    && rm -rf /var/lib/apt/lists/*

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
