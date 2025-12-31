# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Email Agent is an AI-powered email assistant that connects to Gmail, reads emails, and automatically drafts/sends responses using OpenRouter LLMs. It has a Python/FastAPI backend and Next.js frontend.

## Common Commands

```bash
# Start infrastructure (PostgreSQL + Redis)
make db-up

# Run database migrations
make migrate

# Start backend (port 8000)
make backend

# Start frontend (port 3000)
make frontend

# Start ARQ background worker
make worker

# Run tests
make test

# Lint
make lint

# Create new migration
make migrate-new msg="description"
```

**Note**: Use `pnpm` for frontend, `uv` for backend.

## Architecture

### Backend (`backend/`)

FastAPI app with async SQLAlchemy. Key services:

- **`app/services/email_processor.py`** - Core orchestration pipeline. Processes emails through: response check → rule evaluation → draft generation → approval/auto-send
- **`app/services/gmail_service.py`** - Gmail API wrapper (OAuth, fetch, send)
- **`app/services/openrouter_service.py`** - LLM integration via OpenRouter
- **`app/services/rule_engine.py`** - Evaluates automation rules (AND/OR conditions)
- **`app/workers/`** - ARQ background tasks for email polling

API routes in `app/api/v1/`: auth, emails, drafts, rules, settings, gmail

### Frontend (`frontend/`)

Next.js 14 App Router with Tailwind CSS. API calls proxy through Next.js rewrites to backend at `:8000`.

- **`app/dashboard/`** - Main app pages (emails, drafts, rules, settings, activity)
- **`lib/api.ts`** - Axios client with JWT auth interceptor
- Auth uses localStorage JWT tokens

### Data Flow

1. ARQ worker polls Gmail for new emails
2. `EmailProcessor.process_email()` orchestrates response generation
3. Rules determine action: auto-respond, create draft, or ignore
4. Drafts await approval (or auto-send based on settings)
5. Frontend displays drafts queue for user approval

### Approval Modes

- `draft_approval` - All responses require manual approval
- `auto_with_rules` - Auto-send when rules match, draft otherwise
- `fully_automatic` - Auto-respond to everything

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/services/email_processor.py` | Main processing pipeline |
| `backend/app/config.py` | Environment settings (Pydantic) |
| `backend/app/models/` | SQLAlchemy models (User, Email, Draft, Rule) |
| `frontend/lib/api.ts` | API client functions |
| `frontend/next.config.js` | API proxy rewrite to backend |
| `docker-compose.yml` | PostgreSQL + Redis |

## Environment Setup

Backend requires `.env` with:
- `DATABASE_URL` - PostgreSQL async URL
- `REDIS_URL` - Redis connection
- `SECRET_KEY` / `TOKEN_ENCRYPTION_KEY` - Security keys
- `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` - Google OAuth
- `OPENROUTER_API_KEY` - LLM API key

## Gotchas

- SQLAlchemy models can't use `metadata` as column name (reserved)
- Use `from __future__ import annotations` for recursive Pydantic types
- Use bcrypt directly instead of passlib (compatibility issues)
- Frontend uses `useSearchParams()` which requires Suspense boundary in Next.js 14
