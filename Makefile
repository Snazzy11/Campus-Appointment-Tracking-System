
# Mark checks as fake targets
.PHONY: setup lint format typecheck validate

setup:
	uv sync
	git config core.hooksPath .githooks

lint: ## Run linter
	uv run ruff check ./cats

format: ## Run formatter
	uv run ruff format ./cats

typecheck: ## Run static type checker
	uv run mypy

validate: ## Run all validations
	uv run ruff check .
	uv run ruff format --check .
	uv run mypy