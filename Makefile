.PHONY: help install dev backend frontend worker db-up db-down migrate test lint

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
	@echo "  make dev           Start all services (backend, frontend, worker)"
	@echo "  make backend       Start FastAPI backend only"
	@echo "  make frontend      Start Next.js frontend only"
	@echo "  make worker        Start ARQ worker only"
	@echo ""
	@echo "Quality:"
	@echo "  make lint          Run linters"
	@echo "  make test          Run tests"

install:
	cd backend && uv sync
	cd frontend && npm install

db-up:
	docker compose up -d postgres redis
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 3

db-down:
	docker compose down

migrate:
	cd backend && uv run alembic upgrade head

migrate-new:
	cd backend && uv run alembic revision --autogenerate -m "$(msg)"

backend:
	cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev

worker:
	cd backend && uv run arq app.workers.worker.WorkerSettings

dev:
	@echo "Starting all services..."
	@make db-up
	@echo "Run these in separate terminals:"
	@echo "  make backend"
	@echo "  make frontend"
	@echo "  make worker"

test:
	cd backend && uv run pytest

lint:
	cd backend && uv run ruff check . --fix
	cd frontend && npm run lint

setup-env:
	@echo "Creating .env file from example..."
	@cp backend/.env.example backend/.env
	@echo ""
	@echo "Please edit backend/.env with your credentials:"
	@echo "  - GMAIL_CLIENT_ID"
	@echo "  - GMAIL_CLIENT_SECRET"
	@echo "  - OPENROUTER_API_KEY"
	@echo "  - SECRET_KEY (generate with: python -c \"import secrets; print(secrets.token_urlsafe(32))\")"
	@echo "  - TOKEN_ENCRYPTION_KEY (generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\")"
