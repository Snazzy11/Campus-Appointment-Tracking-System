
# Env variable to make outputs prettier
export FORCE_COLOR := 1

# Mark checks as fake targets
.PHONY: setup lint format format-check typecheck validate

setup: setup-hooks setup-backend setup-frontend

setup-frontend:
	@echo "downloading dependencies for the frontend from lockfiles"
	pnpm --dir front_end install --frozen-lockfile

setup-backend:
	@echo "syncing dependenices for the backend from lockfiles "
	uv sync --locked

setup-hooks:
	@echo "settings up git hooks"
	git config core.hooksPath .githooks

application-up: backend-up
	$(MAKE) web-up
	$(MAKE) heatlh
	$(MAKE) status
	$(MAKE) logs

web-up:
	@echo "using pnpm to start the front-end"
	pnpm web

build-web:
	@echo "building the web frontend for shipping"
	pnpm --dir front_end build

backend-up:
	@echo "starting the api and db containers"
	docker compose up --build --wait

backend-down:
	@echo "shutting down the backend"
	docker compose down

api-up:
	@echo "starting just the api"
	uv run uvicorn api.main:app --app-dir back_end/app --reload --port 8000

db-up:
	@echo "launching db docker instance"
	docker compose up -d --wait db

health:
	curl --fail --show-error --max-time 5 http://localhost:8000/health
	@echo

status:
	docker compose ps

logs:
	docker compose logs --follow --tail=100 app

lint: ## Run linter
	@echo "Running linter checks"
	uv run ruff check ./cats

format: ## Run formatter
	@echo "Running automatic formatting"
	uv run ruff format ./cats

format-check: ## Run formatter with only checks
	@echo "Running formatter without auto-fixing"
	uv run ruff format --check ./cats

typecheck: ## Run static type checker
	@echo "Running type checks"
	uv run pyright

validate: ## Run all validations
	@echo "Running all validations"
	make format-check
	make lint
	make typecheck