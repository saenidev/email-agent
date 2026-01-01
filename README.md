# Email Agent

AI-powered email assistant that connects to Gmail, reads your emails, and automatically drafts contextual responses using LLMs. You control what gets sent through approval workflows and automation rules.

## Features

- **Gmail Integration** - Secure OAuth2 connection to read and send emails
- **AI Drafting** - Uses OpenRouter (Claude, GPT, Llama, etc.) to generate contextual responses
- **On-Demand Drafting** - Select unreplied emails and generate drafts immediately with a single click
- **3 Approval Modes**:
  - **Draft for Approval** - All responses require your review before sending
  - **Auto-send with Rules** - Automatic for matching rules, draft for others
  - **Fully Automatic** - Responds to all emails (use with caution)
- **Rule Engine** - Create automation rules based on sender, subject, or body content
- **Web Dashboard** - Modern UI to view emails, approve drafts, and manage rules

## Quick Start

### Prerequisites

- Docker (for PostgreSQL and Redis)
- Node.js 18+ and pnpm
- Python 3.11+ and uv
- Google Cloud project with Gmail API enabled
- OpenRouter API key

### 1. Install Dependencies

```bash
# Clone the repo
git clone https://github.com/yourusername/email-agent.git
cd email-agent

# Install all dependencies
make install
```

### 2. Configure Environment

```bash
# Create .env file from template
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` with your credentials:

```env
# Database (default works with docker-compose)
DATABASE_URL=postgresql+asyncpg://emailagent:emailagent@localhost:5432/emailagent
REDIS_URL=redis://localhost:6379

# Security - generate unique values!
SECRET_KEY=your-secret-key-here
TOKEN_ENCRYPTION_KEY=your-fernet-key-here

# Gmail OAuth (see setup below)
GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=xxx
GMAIL_REDIRECT_URI=http://localhost:8001/api/v1/gmail/auth/callback

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
```

### 3. Start Services

```bash
# Run database migrations
make migrate

# Start everything in one terminal (recommended)
make dev
```

Or start services separately:
```bash
make db-up    # Start PostgreSQL and Redis
make api      # Terminal 1: FastAPI on :8001
make web      # Terminal 2: Next.js on :3000
make worker   # Terminal 3: Background email polling
```

### 4. Use the App

1. Open http://localhost:3000
2. Create an account
3. Go to **Settings** → **Connect Gmail**
4. Configure your preferred approval mode
5. Create automation rules (optional)
6. Watch your emails get processed!

## Gmail OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services** → **Library**
4. Search for and enable **Gmail API**
5. Go to **APIs & Services** → **OAuth consent screen**
   - Choose **External**
   - Fill in app name and contact emails
   - Add scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`
   - Add your Gmail as a test user
6. Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Add redirect URI: `http://localhost:8001/api/v1/gmail/auth/callback`
7. Copy Client ID and Secret to your `.env`

## Development

### Commands

```bash
make help       # Show all commands
make dev        # Start ALL services in one terminal (API + Web + Worker)
make api        # Start FastAPI backend only
make web        # Start Next.js frontend only
make worker     # Start ARQ background worker only
make test       # Run pytest
make lint       # Run linters (ruff + eslint)
make migrate    # Apply database migrations
make migrate-new msg="add feature"  # Create new migration
make db-up      # Start database containers
make db-down    # Stop database containers
```

### Project Structure

```
email-agent/
├── apps/
│   ├── api/                    # Python/FastAPI backend
│   │   ├── app/
│   │   │   ├── api/v1/         # FastAPI routes
│   │   │   ├── models/         # SQLAlchemy models
│   │   │   ├── schemas/        # Pydantic schemas
│   │   │   ├── services/       # Business logic
│   │   │   │   ├── email_processor.py   # Main orchestration
│   │   │   │   ├── gmail_service.py     # Gmail API
│   │   │   │   ├── openrouter_service.py # LLM calls
│   │   │   │   └── rule_engine.py       # Rule evaluation
│   │   │   └── workers/        # ARQ background tasks
│   │   └── alembic/            # Database migrations
│   └── web/                    # Next.js frontend
│       ├── app/
│       │   ├── dashboard/      # Main app pages
│       │   ├── login/          # Auth pages
│       │   └── register/
│       └── lib/
│           └── api.ts          # API client
├── packages/                   # Shared packages (future)
├── turbo.json                  # Turborepo config
├── pnpm-workspace.yaml         # pnpm workspaces
└── docker-compose.yml          # PostgreSQL + Redis
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm workspaces |
| API | Python 3.11+ / FastAPI / SQLAlchemy (async) |
| Web | Next.js 14 / React / Tailwind CSS |
| Database | PostgreSQL |
| Queue | ARQ + Redis |
| LLM | OpenRouter API |
| Email | Gmail API (OAuth2) |

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/register` | Create account |
| `POST /api/v1/auth/login` | Login, get JWT |
| `GET /api/v1/gmail/auth/url` | Get Gmail OAuth URL |
| `GET /api/v1/gmail/status` | Check Gmail connection |
| `GET /api/v1/emails` | List cached emails |
| `GET /api/v1/emails/unreplied` | List emails without active drafts |
| `POST /api/v1/emails/sync` | Sync from Gmail |
| `POST /api/v1/emails/generate-drafts` | Queue selected emails for draft generation |
| `GET /api/v1/emails/generate-drafts/{id}/status` | Poll batch job progress |
| `GET /api/v1/drafts` | List AI-generated drafts |
| `POST /api/v1/drafts/{id}/approve` | Approve and send |
| `POST /api/v1/drafts/{id}/reject` | Reject draft |
| `GET /api/v1/rules` | List automation rules |
| `POST /api/v1/rules` | Create rule |
| `GET /api/v1/settings` | Get user settings |
| `PUT /api/v1/settings` | Update settings |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Next.js   │────▶│   FastAPI   │────▶│  PostgreSQL  │
│  Dashboard  │     │     API     │     │   Database   │
└─────────────┘     └─────────────┘     └──────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌───────────┐  ┌─────────┐
        │  Redis  │  │ OpenRouter│  │  Gmail  │
        │  Queue  │  │   (LLM)   │  │   API   │
        └─────────┘  └───────────┘  └─────────┘
              │
        ┌─────────┐
        │   ARQ   │
        │ Worker  │
        └─────────┘
```

**Automatic Processing:** The ARQ worker polls Gmail for new emails. Each email goes through the `EmailProcessor` pipeline:
1. **Response Check** - LLM determines if email needs a response
2. **Rule Evaluation** - Checks against user's automation rules
3. **Draft Generation** - LLM generates contextual response
4. **Action** - Create draft for approval, auto-send, or ignore

**On-Demand Drafting:** Users can manually select unreplied emails and trigger immediate draft generation:
1. Toggle "Unreplied Only" filter in Inbox
2. Select emails via checkboxes
3. Click "Generate Drafts" to queue them
4. Real-time progress bar shows generation status
5. Review and approve drafts in the Drafts page

## Troubleshooting

### API won't start / "bad interpreter" error
After cloning or moving the repo, the Python virtual environment may have stale paths. Fix by recreating it:
```bash
rm -rf apps/api/.venv
cd apps/api && uv sync
```

### Port 8001 already in use
The API runs on port 8001. Check what's using it:
```bash
lsof -i :8001
```

### Frontend can't connect to API
Ensure the API is running on port 8001. The frontend proxies `/api/v1/*` requests to `localhost:8001`.

### Database connection errors
Make sure PostgreSQL and Redis are running:
```bash
make db-up
docker ps  # Should show emailagent-postgres and emailagent-redis
```

## License

MIT
