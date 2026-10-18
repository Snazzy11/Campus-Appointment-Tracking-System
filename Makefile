
# Env variable to make outputs prettier
export FORCE_COLOR := 1

# Mark checks as fake targets
.PHONY: setup lint format format-check typecheck validate

setup:
	uv sync
	git config core.hooksPath .githooks

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
	## TODO: It will eventually be important to mark this as 'validate_backend' or similar as we add more tests
	@echo "Running all validations"
	make format-check
	make lint
	make typecheck