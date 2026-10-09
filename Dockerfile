FROM python:3.14.7-slim-trixie

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1

WORKDIR /cats

RUN apt-get update && apt-get install -y --no-install-recommends file \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./

# --no-emit-project excludes the local root package from requirements.txt
RUN uv export --frozen --no-dev --no-emit-project > requirements.txt \
    && uv pip install --system -r requirements.txt

COPY ./cats/ /cats/

EXPOSE 8000

CMD ["uvicorn", "api/main:app", "--host", "0.0.0.0", "--port", "8000"]