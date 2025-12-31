# Email Agent

AI-powered email assistant that connects to Gmail, reads your emails, and automatically drafts contextual responses using LLMs. You control what gets sent through approval workflows and automation rules.

## Features

- **Gmail Integration** - Secure OAuth2 connection to read and send emails
- **AI Drafting** - Uses OpenRouter (Claude, GPT, Llama, etc.) to generate contextual responses
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
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your credentials:

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
GMAIL_REDIRECT_URI=http://localhost:8000/api/v1/gmail/auth/callback

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
```

### 3. Start Services

```bash
# Start PostgreSQL and Redis
make db-up

# Run database migrations
make migrate

# In separate terminals:
make backend   # Terminal 1: FastAPI on :8000
make frontend  # Terminal 2: Next.js on :3000
make worker    # Terminal 3: Background email polling
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
   - Add redirect URI: `http://localhost:8000/api/v1/gmail/auth/callback`
7. Copy Client ID and Secret to your `.env`

## Development

### Commands

```bash
make help       # Show all commands
make dev        # Instructions for starting all services
make backend    # Start FastAPI with hot reload
make frontend   # Start Next.js dev server
make worker     # Start ARQ background worker
make test       # Run pytest
make lint       # Run linters (ruff)
make migrate    # Apply database migrations
make migrate-new msg="add feature"  # Create new migration
make db-down    # Stop database containers
```

### Project Structure

```
email-agent/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # FastAPI routes
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic
│   │   │   ├── email_processor.py   # Main orchestration
│   │   │   ├── gmail_service.py     # Gmail API
│   │   │   ├── openrouter_service.py # LLM calls
│   │   │   └── rule_engine.py       # Rule evaluation
│   │   └── workers/         # ARQ background tasks
│   └── alembic/             # Database migrations
├── frontend/
│   ├── app/
│   │   ├── dashboard/       # Main app pages
│   │   ├── login/           # Auth pages
│   │   └── register/
│   └── lib/
│       └── api.ts           # API client
└── docker-compose.yml       # PostgreSQL + Redis
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.11+ / FastAPI / SQLAlchemy (async) |
| Frontend | Next.js 14 / React / Tailwind CSS |
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
| `POST /api/v1/emails/sync` | Sync from Gmail |
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
│  Dashboard  │     │   Backend   │     │   Database   │
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

The ARQ worker polls Gmail for new emails. Each email goes through the `EmailProcessor` pipeline:
1. **Response Check** - LLM determines if email needs a response
2. **Rule Evaluation** - Checks against user's automation rules
3. **Draft Generation** - LLM generates contextual response
4. **Action** - Create draft for approval, auto-send, or ignore

## License

MIT
