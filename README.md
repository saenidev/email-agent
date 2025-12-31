# Email Agent

AI-powered email assistant that connects to Gmail, reads emails, and automatically drafts/sends responses using OpenRouter LLMs.

## Features

- **Gmail Integration** - OAuth2 connection to read and send emails
- **AI Drafting** - Uses OpenRouter (Claude, GPT, Llama) to generate contextual responses
- **3 Approval Modes**:
  - Draft for Approval (safest)
  - Auto-send with Rules (conditional automation)
  - Fully Automatic (responds to all emails)
- **Rule Engine** - Create rules based on sender, subject, keywords
- **Web Dashboard** - View emails, approve drafts, manage rules

## Tech Stack

- **Backend**: Python 3.11+ / FastAPI / SQLAlchemy (async)
- **Frontend**: Next.js 14 / React / Tailwind / shadcn/ui
- **Database**: PostgreSQL
- **Task Queue**: ARQ + Redis
- **LLM**: OpenRouter API

## Prerequisites

1. **Google Cloud Project** with Gmail API enabled
   - Create OAuth2 credentials (Web Application)
   - Add `http://localhost:8000/api/v1/gmail/auth/callback` as redirect URI

2. **OpenRouter API Key** from https://openrouter.ai/keys

3. **Docker** for PostgreSQL and Redis

## Quick Start

```bash
# 1. Clone and enter directory
cd email-agent

# 2. Install dependencies
make install

# 3. Create environment file
make setup-env
# Then edit backend/.env with your credentials

# 4. Start database services
make db-up

# 5. Run migrations
make migrate

# 6. Start services (run each in separate terminal)
make backend   # Terminal 1: FastAPI on :8000
make frontend  # Terminal 2: Next.js on :3000
make worker    # Terminal 3: ARQ worker
```

## Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://emailagent:emailagent@localhost:5432/emailagent

# Redis
REDIS_URL=redis://localhost:6379

# Security (generate unique values!)
SECRET_KEY=your-secret-key
TOKEN_ENCRYPTION_KEY=your-fernet-key

# Gmail OAuth
GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=xxx
GMAIL_REDIRECT_URI=http://localhost:8000/api/v1/gmail/auth/callback

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
```

### Gmail OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API
4. Configure OAuth consent screen (External, add your email as test user)
5. Create OAuth 2.0 credentials (Web Application type)
6. Add authorized redirect URI: `http://localhost:8000/api/v1/gmail/auth/callback`
7. Copy Client ID and Secret to `.env`

## Usage

1. Open http://localhost:3000
2. Create an account
3. Go to Settings and connect Gmail
4. Configure approval mode and AI model
5. Create automation rules (optional)
6. Watch emails get processed!

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/register` | Register new user |
| `POST /api/v1/auth/login` | Login, get JWT |
| `GET /api/v1/gmail/auth/url` | Get Gmail OAuth URL |
| `GET /api/v1/emails` | List emails |
| `GET /api/v1/drafts` | List AI drafts |
| `POST /api/v1/drafts/{id}/approve` | Approve and send |
| `GET /api/v1/rules` | List automation rules |
| `GET /api/v1/settings` | Get user settings |

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

## Development

```bash
# Lint code
make lint

# Run tests
make test

# Create new migration
make migrate-new msg="add new table"

# Stop database
make db-down
```

## License

MIT
