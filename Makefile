
# Env variable to make outputs prettier
export FORCE_COLOR := 1

# Mark checks as fake targets
.PHONY: help setup setup-frontend setup-backend setup-hooks application-up web-up build-web backend-up backend-down api-up db-up health status logs test-api lint format format-check typecheck validate validate-backend validate-frontend frontend-lint frontend-format frontend-format-check frontend-typecheck

# Running `make` with no target prints the help below.
.DEFAULT_GOAL := help

##@ Help

# To document a target, add `## description` after it on the same line.
# To start a new group in the help output, add a `##@ Group name` line.
help: ## Show this help message
	@awk 'BEGIN {FS = ":.*## "} \
		/^##@/ {printf "\n\033[1m%s\033[0m\n", substr($$0, 5)} \
		/^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

##@ Setup

setup: setup-hooks setup-backend setup-frontend ## Install everything and set up git hooks
setup-frontend: ## Install frontend packages from the lockfile
	@echo "downloading dependencies for the frontend from lockfiles"
	pnpm --dir front_end install --frozen-lockfile

setup-backend: ## Install backend packages from the lockfile
	@echo "syncing dependenices for the backend from lockfiles "
	uv sync --locked

setup-hooks: ## Use the repo's git hooks (.githooks/)
	@echo "settings up git hooks"
	git config core.hooksPath .githooks

##@ Run

application-up: backend-up ## Start backend, run checks, then start the web app
	$(MAKE) health
	$(MAKE) test-api
	$(MAKE) status
	$(MAKE) web-up

web-up: ## Start the frontend in the browser
	@echo "using pnpm to start the front-end"
	pnpm web

build-web: ## Build the web frontend into front_end/dist
	@echo "building the web frontend for shipping"
	pnpm --dir front_end build

backend-up: ## Build and start the API + database containers
	@echo "starting the api and db containers"
	docker compose up --build --wait

backend-down: ## Stop the API + database containers
	@echo "shutting down the backend"
	docker compose down

api-up: ## Run the API locally with auto-reload (no Docker)
	@echo "starting just the api"
	uv run uvicorn api.main:app --app-dir back_end/app --reload --port 8000

db-up: ## Start only the database container
	@echo "launching db docker instance"
	docker compose up -d --wait db

##@ Status and debugging

health: ## Check that the API is responding
	curl --fail --show-error --max-time 5 http://localhost:8000/health
	@echo

status: ## Show running containers
	docker compose ps

logs: ## Follow the API container's logs
	docker compose logs --follow --tail=100 app

##@ Backend checks

test-api: ## Run backend API tests
	@echo "runnning api tests..."
	PYTHONPATH=back_end/app uv run pytest back_end/app/api/test_api.py -v

lint: ## Run backend linter (ruff)
	@echo "Running linter checks"
	uv run ruff check ./back_end

format: ## Run backend formatter (ruff)
	@echo "Running automatic formatting"
	uv run ruff format ./back_end

format-check: ## Run backend formatter with only checks
	@echo "Running formatter without auto-fixing"
	uv run ruff format --check ./back_end

typecheck: ## Run backend type checker (pyright)
	@echo "Running type checks"
	uv run pyright

validate-backend: ## Run all backend validations
	@echo "Running backend validations"
	make format-check
	make lint
	make typecheck

##@ Frontend checks

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

##@ All checks

validate: validate-backend validate-frontend ## Run all backend and frontend checks (what CI runs)
