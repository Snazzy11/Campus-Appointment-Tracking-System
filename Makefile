
# Env variable to make outputs prettier
export FORCE_COLOR := 1

# Mark checks as fake targets
.PHONY: setup setup-frontend setup-backend setup-hooks application-up web-up build-web backend-up backend-down api-up db-up health status logs test-api lint format format-check typecheck validate validate-backend validate-frontend frontend-lint frontend-format frontend-format-check frontend-typecheck

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
	$(MAKE) health
	$(MAKE) test-api
	$(MAKE) status
	$(MAKE) web-up

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

test-api:
	@echo "runnning api tests..."
	PYTHONPATH=back_end/app uv run pytest back_end/app/api/test_api.py -v	
lint: ## Run linter
	@echo "Running linter checks"
	uv run ruff check ./back_end

format: ## Run formatter
	@echo "Running automatic formatting"
	uv run ruff format ./back_end

format-check: ## Run formatter with only checks
	@echo "Running formatter without auto-fixing"
	uv run ruff format --check ./back_end

typecheck: ## Run static type checker
	@echo "Running type checks"
	uv run pyright

validate: validate-backend validate-frontend ## Run all validations

validate-backend: ## Run all backend validations
	@echo "Running backend validations"
	make format-check
	make lint
	make typecheck

frontend-lint: ## Run frontend linter (ESLint)
	@echo "Running frontend linter checks"
	pnpm --dir front_end lint

frontend-format: ## Run frontend formatter (Prettier)
	@echo "Running frontend automatic formatting"
	pnpm --dir front_end format

frontend-format-check: ## Run frontend formatter with only checks
	@echo "Running frontend formatter without auto-fixing"
	pnpm --dir front_end format:check

frontend-typecheck: ## Run frontend type checker (TypeScript)
	@echo "Running frontend type checks"
	pnpm --dir front_end typecheck

validate-frontend: ## Run all frontend validations
	@echo "Running frontend validations"
	make frontend-format-check
	make frontend-lint
	make frontend-typecheck