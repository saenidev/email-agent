# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Email Agent is an AI-powered email assistant that connects to Gmail, reads emails, and automatically drafts/sends responses using OpenRouter LLMs. It's a Turborepo monorepo with a Python/FastAPI backend and Next.js frontend.

## Common Commands

```bash
# Start everything (DB + API + Web + Worker) in one terminal
make dev

# Or start services individually:
make db-up      # Start PostgreSQL and Redis
make migrate    # Run database migrations
make api        # Start API backend (port 8001)
make web        # Start web frontend (port 3000)
make worker     # Start ARQ background worker

# Quality
make test       # Run tests
make lint       # Run linters

# Create new migration
make migrate-new msg="description"
```

**Note**: Use `pnpm` for JS/Turborepo, `uv` for Python.

## Architecture

### Monorepo Structure

```
email-agent/
├── apps/
│   ├── api/          # Python/FastAPI backend
│   └── web/          # Next.js frontend
├── packages/         # Shared packages (future)
├── turbo.json        # Turborepo config
└── pnpm-workspace.yaml
```

### API (`apps/api/`)

FastAPI app with async SQLAlchemy. Key services:

- **`app/services/email_processor.py`** - Core orchestration pipeline. Processes emails through: response check → rule evaluation → draft generation → approval/auto-send
- **`app/services/gmail_service.py`** - Gmail API wrapper (OAuth, fetch, send)
- **`app/services/openrouter_service.py`** - LLM integration via OpenRouter
- **`app/services/rule_engine.py`** - Evaluates automation rules (AND/OR conditions)
- **`app/workers/`** - ARQ background tasks for email polling

API routes in `app/api/v1/`: auth, emails, drafts, rules, settings, gmail

### Web (`apps/web/`)

Next.js 14 App Router with Tailwind CSS. API calls proxy through Next.js rewrites to backend at `:8001`.

- **`app/dashboard/`** - Main app pages (emails, drafts, rules, settings, activity)
- **`lib/api.ts`** - Axios client with JWT auth interceptor
- Auth uses localStorage JWT tokens

### Data Flow

**Automatic Processing (Background):**
1. ARQ worker polls Gmail for new emails
2. `EmailProcessor.process_email()` orchestrates response generation
3. Rules determine action: auto-respond, create draft, or ignore
4. Drafts await approval (or auto-send based on settings)
5. Frontend displays drafts queue for user approval

**On-Demand Drafting (User-Initiated):**
1. User toggles "Unreplied Only" filter in Inbox
2. User selects emails via checkboxes
3. User clicks "Generate Drafts" → creates `BatchDraftJob`
4. API enqueues `generate_draft_for_email` tasks to ARQ
5. Frontend polls job status, shows progress bar
6. Drafts appear in Drafts page for approval

### Approval Modes

- `draft_approval` - All responses require manual approval
- `auto_with_rules` - Auto-send when rules match, draft otherwise
- `fully_automatic` - Auto-respond to everything

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/app/services/email_processor.py` | Main processing pipeline |
| `apps/api/app/config.py` | Environment settings (Pydantic) |
| `apps/api/app/models/` | SQLAlchemy models (User, Email, Draft, Rule, BatchDraftJob) |
| `apps/api/app/workers/tasks.py` | ARQ tasks (polling, sending, on-demand drafting) |
| `apps/web/lib/api.ts` | API client functions |
| `apps/web/hooks/useEmailSelection.ts` | Email multi-select state hook |
| `apps/web/next.config.js` | API proxy rewrite to backend |
| `docker-compose.yml` | PostgreSQL + Redis |

## Environment Setup

API requires `apps/api/.env` with:
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
- After moving/cloning the repo, recreate Python venv: `rm -rf apps/api/.venv && cd apps/api && uv sync`
- API runs on port 8001 (not 8000) to avoid conflicts with other projects
