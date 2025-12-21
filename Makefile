.PHONY: lint
lint:
	@echo "Running ruff format..."
	uv run ruff format .
	@echo "Running ruff check with auto-fix..."
	uv run ruff check --fix .
	@echo "Running ruff check (final validation)..."
	uv run ruff check .
