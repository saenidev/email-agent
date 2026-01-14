# Email Agent - Product Specification

## Executive Summary

Email Agent is an AI-powered Gmail automation tool that reduces email management burden through intelligent draft generation, multi-agent validation workflows, and configurable automation rules. Built as a self-hosted solution for personal and project integration use, it evolves from a human-in-the-loop draft approval system to a fully autonomous email assistant with quality safeguards. The system prioritizes reliability and security while providing a platform for agentic email workflows.

---

## Problem Statement

### The Pain
Email management consumes significant time and mental energy. The current approach results in:
- **Hours lost daily** reading, processing, and composing responses
- **Delayed responses** damaging relationships and missing opportunities
- **Inconsistent quality** when time or energy is limited
- **Mental burden** from inbox anxiety and unprocessed email backlog

### Why It Matters
For a busy professional handling 50-200 emails daily, even modest automation (50% time savings) recovers hours each day. Beyond personal productivity, this enables:
- Integration with other projects as an API/plugin
- Foundation for more sophisticated agentic workflows
- Reduced cognitive load allowing focus on high-value work

### Cost of Inaction
Without automation, email management remains a reactive, manual process that scales poorly with volume and creates ongoing stress.

---

## Goals & Non-Goals

### Goals

1. **Automate Gmail inbox processing** with AI-generated draft responses
2. **Maintain quality through validation** via multi-agent review loops
3. **Provide configurable automation levels** from full human approval to autonomous sending
4. **Build reliable, secure foundation** suitable for mission-critical personal use
5. **Enable future extensibility** as API/plugin for other projects

### Non-Goals

- **Not a full email client** - Augments Gmail, doesn't replace it
- **Not marketing automation** - No mass outreach, newsletters, or cold email
- **Not multi-provider** - Gmail only (no Outlook/Exchange support planned)
- **Not a mobile app** - Web-first, accessed via browser

---

## User Personas & Journeys

### Primary Persona: Power User / Developer

**Profile:** Technical user managing personal and project emails, comfortable with self-hosted tools, values automation and control.

**Key Journeys:**

#### Journey 1: Daily Email Triage
1. Morning: Check dashboard for overnight emails
2. Review AI-generated drafts for quality
3. Approve good drafts, edit mediocre ones, regenerate poor ones
4. Batch process remaining unreplied emails
5. Confidence grows → adjust automation level upward

#### Journey 2: Setting Up Automation Rules
1. Notice recurring email patterns (e.g., meeting requests, status updates)
2. Create rules with conditions (sender, subject keywords)
3. Set action: auto-respond for low-risk, draft-only for important
4. Monitor activity log to verify rules working correctly
5. Iterate rules based on results

#### Journey 3: Building Trust in Full Automation
1. Start with `draft_approval` mode (approve everything)
2. Review AI quality over days/weeks
3. Enable `auto_with_rules` for specific trusted patterns
4. Expand rules as confidence builds
5. Optionally move to `fully_automatic` with guardrails

### Edge Cases to Handle
- Emails requiring nuanced judgment (complaints, negotiations)
- Emails with factual questions AI might hallucinate answers to
- First contact from new senders (no history to reference)
- Emails containing sensitive information
- Thread replies where context is critical

---

## Technical Requirements

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Email Agent                             │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)           │  Background Workers (ARQ)   │
│  - Dashboard UI               │  - Gmail polling            │
│  - Draft approval             │  - Draft generation         │
│  - Rules management           │  - Email sending            │
│  - Settings                   │  - Validation loops         │
├─────────────────────────────────────────────────────────────┤
│                    API Layer (FastAPI)                       │
│  - Auth (JWT)                 │  - Rules engine             │
│  - Gmail OAuth                │  - Activity logging         │
│  - CRUD endpoints             │  - Batch operations         │
├─────────────────────────────────────────────────────────────┤
│                   Services Layer                             │
│  - EmailProcessor (orchestration)                           │
│  - GmailService (API wrapper)                               │
│  - OpenRouterService (LLM)                                  │
│  - RuleEngine (conditions)                                  │
│  - Multi-Agent System (future)                              │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL          │  Redis            │  OpenRouter      │
│  (persistence)       │  (queue/cache)    │  (LLM API)       │
└─────────────────────────────────────────────────────────────┘
```

### Integration Requirements

| System | Integration Type | Purpose |
|--------|-----------------|---------|
| Gmail | OAuth2 + REST API | Fetch emails, send responses |
| OpenRouter | REST API | LLM inference for drafts |
| PostgreSQL | Direct connection | Persistent storage |
| Redis | Direct connection | Task queue, caching |

### Performance Requirements

| Metric | Requirement |
|--------|-------------|
| Email volume | 50-200 emails/day |
| Draft generation latency | < 30 seconds |
| Sync frequency | Every 5 minutes (configurable) |
| UI response time | < 500ms for page loads |

### Data Persistence

| Data | Retention | Consistency |
|------|-----------|-------------|
| Emails | Indefinite (cached from Gmail) | Eventually consistent with Gmail |
| Drafts | Indefinite | Strong consistency |
| Activity log | Indefinite | Append-only |
| OAuth tokens | Until revoked | Encrypted at rest |
| User settings | Indefinite | Strong consistency |

### Security Requirements

**Non-negotiable:**
- OAuth tokens encrypted at rest (Fernet)
- JWT authentication for API
- No plaintext credentials in logs or errors
- HTTPS in production
- Input validation on all endpoints

**Gmail API scopes (minimal):**
- `gmail.readonly` - Read emails
- `gmail.send` - Send responses
- `gmail.modify` - Mark as read, labels

---

## Tech Stack

### Current Stack (Established)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14, React, Tailwind, shadcn/ui | Modern React with App Router, great DX |
| Backend | FastAPI, Python 3.11+ | Async-first, excellent for AI workloads |
| ORM | SQLAlchemy (async) | Mature, flexible, good async support |
| Database | PostgreSQL | Reliable, feature-rich, JSON support |
| Queue | ARQ + Redis | Simple, Python-native, reliable |
| LLM | OpenRouter | Multi-model access, simple API |
| Package mgmt | pnpm (JS), uv (Python) | Fast, modern tools |
| Deployment | Docker Compose | Simple, self-hosted, current setup works |

### Tech Stack Decisions (From Interview)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent framework | **Custom/minimal** | Full control, no dependencies, fits project size |
| Agent communication | Shared state object | Simple `ProcessingContext` dict passed through pipeline |
| Structured LLM outputs | **Pydantic + Instructor** | Type-safe extraction with automatic retries |
| Knowledge base / RAG | **Deferred** | Skip for now, use simpler context injection first |
| Observability | **Logs only** | Structured logging to stdout, grep when needed |
| Agent traces | Extend existing | Store in draft.llm_reasoning + activity log |
| Testing strategy | **Guardrails-first** | Focus on preventing bad outcomes, not validating every output |

### Future Additions (Planned)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Vector store | pgvector (when needed) | Knowledge base RAG |
| Webhooks | Custom implementation | Push events to registered URLs |
| Monitoring | Logs → metrics later | Start simple, add Prometheus if needed |

### Dependencies to Add

```python
# For structured LLM outputs
instructor  # Type-safe extraction with Pydantic models
```

### Integration Architecture

| Integration | Method | Purpose |
|-------------|--------|---------|
| Other projects | REST API | Call email-agent's existing endpoints |
| Event notifications | Webhooks | Push events (draft created, email sent) to URLs |

---

## UI/UX Requirements

### Design Principles
- **Functional over polished** - UI can be rough, core functionality matters
- **Information density** - Show relevant data without excessive clicks
- **Clear status indicators** - Always know what the system is doing
- **Keyboard shortcuts** - Power user efficiency

### Key Screens

1. **Inbox** - Email list with search, sort, pagination, batch select
2. **Drafts** - Queue of pending drafts with approve/reject/edit/regenerate
3. **Rules** - CRUD for automation rules with condition builder
4. **Settings** - Gmail connection, approval mode, LLM config, signature
5. **Activity** - Audit log of all system actions

### Accessibility
- Basic accessibility (semantic HTML, keyboard navigation)
- Not a primary focus for personal tool

### Degraded Mode Behavior
- If LLM unavailable: Queue emails, retry later
- If Gmail unavailable: Show cached data, queue sends
- If Redis unavailable: Fall back to sync processing

---

## Multi-Agent Architecture (Next Milestone)

### Agent Roles

| Agent | Responsibility |
|-------|---------------|
| **Classifier** | Categorize email, determine if response needed |
| **Researcher** | Gather context (thread history, contact history, knowledge base, web search) |
| **Drafter** | Generate initial response using gathered context |
| **Reviewer** | Validate draft (tone, accuracy, completeness, safety) |
| **Submitter** | Handle sending logic, rate limiting, guardrails |

### Validation Checks (Reviewer Agent)

1. **Tone/professionalism** - Matches appropriate register for recipient
2. **Factual accuracy** - Claims/dates/names match original email
3. **Completeness** - All questions answered, nothing missed
4. **Safety** - No sensitive info leaked, no incorrect commitments

### Context Sources

| Source | Priority | Implementation |
|--------|----------|---------------|
| Email thread | Must have | Already available |
| Contact history | Should have | Query previous emails from sender |
| Knowledge base | Should have | Manual upload, structured templates |
| Web search | Nice to have | Optional tool for research agent |

### Confidence & Fallback

- Always generate draft (even low confidence)
- Include confidence score in draft metadata
- Low confidence drafts flagged for extra review
- Guardrail violations → downgrade to draft (never auto-send)

### Guardrails System

**Core Guardrails (Admin Configurable via Settings):**

| Guardrail | Description | Violation Handling |
|-----------|-------------|-------------------|
| **Recipient validation** | Only reply to original sender, never add new recipients | Downgrade to draft |
| **Content filters** | Block patterns from being auto-sent | Downgrade to draft |
| **Confidence threshold** | Minimum score required for auto-actions | Downgrade to draft |

**Content Filter Categories:**

1. **Profanity/offensive** - Block crude or inappropriate language
2. **Commitment words** - Flag "I agree", "I'll pay", "confirmed", "approved" for review
3. **Personal info patterns** - Block SSN, credit card numbers, password-like strings
4. **Custom keywords** - User-defined blocklist

**Guardrail Philosophy:** Focus on preventing catastrophic failures rather than validating every output. If any guardrail triggers, the draft is presented for human review rather than auto-sent.

---

## Success Metrics

### Primary KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time savings | 50%+ reduction in email time | Self-reported |
| Draft acceptance rate | >70% approved without major edits | (approved + minor_edit) / total |
| Response coverage | 90%+ of emails get responses | responded / requires_response |

### Quality Indicators

| Indicator | Signal |
|-----------|--------|
| Edit rate | Lower = better draft quality |
| Regeneration rate | Lower = first draft usually good |
| Rule trigger accuracy | High = rules matching intended emails |

### Operational Health

| Metric | Target |
|--------|--------|
| Sync reliability | 99%+ successful syncs |
| Draft generation success | 99%+ complete without error |
| Send delivery rate | 100% (Gmail handles delivery) |

---

## Risks & Mitigations

### Risk 1: AI Quality Issues
**Concern:** Drafts require heavy editing, defeating productivity gains

**Mitigations:**
- Multi-agent validation before presenting draft
- User knowledge base for domain-specific context
- Confidence scoring to set expectations
- Easy regeneration with custom prompts
- Model selection flexibility via OpenRouter

### Risk 2: Runaway Automation
**Concern:** Agent sends embarrassing or incorrect emails

**Mitigations:**
- Start with `draft_approval` mode (no auto-send)
- Rate limiting on auto-sends
- Keyword blocklist for sensitive terms
- New sender caution (always draft for first contact)
- Clear audit trail in activity log
- Easy kill switch (disable rules, change mode)

### Risk 3: Reliability Issues
**Concern:** Missing emails, failed syncs, data loss

**Mitigations:**
- Incremental sync with history_id (Gmail best practice)
- Fallback to full sync if history invalid
- Idempotent email processing (gmail_id uniqueness)
- Persistent task queue (Redis + ARQ)
- Health checks and monitoring
- Local/self-hosted reduces external dependencies

### Risk 4: Complexity Creep
**Concern:** Agentic features become unmaintainable

**Mitigations:**
- Clear agent boundaries with single responsibilities
- Balanced approach: stable core, experimental features separate
- Incremental adoption (start simple, add agents gradually)
- Good logging for debugging agent behavior
- Test infrastructure before shipping

---

## Open Questions

### Resolved (From Tech Stack Interview)
- [x] Agent framework → **Custom/minimal** (no external framework)
- [x] Agent communication → **Shared state object** (ProcessingContext dict)
- [x] Agent traces storage → **Extend existing** (draft.llm_reasoning + activity log)
- [x] Structured outputs → **Pydantic + Instructor**
- [x] Knowledge base → **Deferred** (skip RAG for now)
- [x] Testing strategy → **Guardrails-first** (prevent bad outcomes)
- [x] Guardrail violations → **Downgrade to draft** (never auto-send on violation)
- [x] Guardrails config → **Admin configurable** via settings

### Still Open

#### LLM Costs
- [ ] Cost per email at current volume? (Estimate: ~$0.01-0.05/email with cheap models)
- [ ] Caching strategies to reduce redundant LLM calls?

#### Implementation Details
- [ ] Exact content filter regex patterns?
- [ ] Commitment word list - what specific phrases?
- [ ] Profanity filter - use existing library or custom?
- [ ] How to handle multi-language content filters?

#### Future Decisions
- [ ] Webhook event schema and authentication
- [ ] When to add pgvector for knowledge base
- [ ] Rate limiting numbers (if added later)

---

## Implementation Roadmap

### Phase 1: Current State (Complete)
- [x] Gmail OAuth integration
- [x] Email sync and caching
- [x] Single-model draft generation
- [x] Approval workflow (approve/reject/edit)
- [x] Rules engine with AND/OR conditions
- [x] Batch draft generation
- [x] Activity logging
- [x] User settings

### Phase 2: Guardrails & Validation (Next)
- [ ] Add `instructor` dependency for structured LLM outputs
- [ ] Implement content filters (profanity, commitments, PII, custom)
- [ ] Recipient validation guardrail
- [ ] Confidence scoring with threshold
- [ ] Guardrails settings UI (admin configurable)
- [ ] Reviewer agent for draft validation
- [ ] Contact history lookup

### Phase 3: Full Multi-Agent (Future)
- [ ] Classifier agent
- [ ] Researcher agent
- [ ] Drafter agent (refactor existing)
- [ ] Submitter agent with guardrails enforcement
- [ ] ProcessingContext shared state pattern
- [ ] Knowledge base (templates, uploads) - when needed

### Phase 4: Platform (Future)
- [ ] API documentation
- [ ] Webhook integrations
- [ ] Multi-user support
- [ ] Usage analytics

---

## Appendix: Current Database Schema

```sql
-- Core entities
users (id, email, hashed_password, is_active, timestamps)
gmail_tokens (user_id, gmail_email, encrypted_tokens, history_id)
user_settings (user_id, approval_mode, llm_model, temperature, prompts)

-- Email data
emails (user_id, gmail_id, thread_id, from/to/cc, subject, body, status, timestamps)
drafts (user_id, email_id, to/cc, subject, body, status, llm_metadata, timestamps)

-- Automation
rules (user_id, name, conditions, action, priority, is_active)
batch_draft_jobs (user_id, email_ids, progress, status)

-- Audit
activity (user_id, type, description, references, timestamp)
```

---

*Specification version: 1.1*
*Last updated: 2026-01-14*
*Author: Generated from product interview*
*Revision: Added tech stack decisions from interview*
