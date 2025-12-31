.PHONY: help install dev api web worker db-up db-down migrate test lint

help:
	@echo "Email Agent - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install       Install all dependencies"
	@echo "  make db-up         Start PostgreSQL and Redis"
	@echo "  make db-down       Stop PostgreSQL and Redis"
	@echo "  make migrate       Run database migrations"
	@echo ""
	@echo "Development:"
	@echo "  make dev           Instructions for starting all services"
	@echo "  make api           Start FastAPI backend"
	@echo "  make web           Start Next.js frontend (or: pnpm dev)"
	@echo "  make worker        Start ARQ worker"
	@echo ""
	@echo "Quality:"
	@echo "  make lint          Run linters"
	@echo "  make test          Run tests"

install:
	cd apps/api && uv sync
	pnpm install

db-up:
	docker compose up -d postgres redis
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 3

db-down:
	docker compose down

migrate:
	cd apps/api && uv run alembic upgrade head

migrate-new:
	cd apps/api && uv run alembic revision --autogenerate -m "$(msg)"

api:
	cd apps/api && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

web:
	pnpm dev

worker:
	cd apps/api && uv run arq app.workers.worker.WorkerSettings

dev:
	@echo "Starting all services..."
	@make db-up
	@echo ""
	@echo "Run these in separate terminals:"
	@echo "  make api      # FastAPI on :8001"
	@echo "  make web      # Next.js on :3000 (or: pnpm dev)"
	@echo "  make worker   # ARQ background worker"

test:
	cd apps/api && uv run pytest

lint:
	cd apps/api && uv run ruff check . --fix
	pnpm lint

setup-env:
	@echo "Creating .env file from example..."
	@cp apps/api/.env.example apps/api/.env
	@echo ""
	@echo "Please edit apps/api/.env with your credentials:"
	@echo "  - GMAIL_CLIENT_ID"
	@echo "  - GMAIL_CLIENT_SECRET"
	@echo "  - OPENROUTER_API_KEY"
	@echo "  - SECRET_KEY (generate with: python -c \"import secrets; print(secrets.token_urlsafe(32))\")"
	@echo "  - TOKEN_ENCRYPTION_KEY (generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\")"
