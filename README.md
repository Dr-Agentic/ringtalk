# RingTalk

> AI agents as native RingEX teammates. @mention an agent, get expert-level work done in the same thread.

**[Live Demo](https://ringtalk-2026-07-21.pages.dev/journey.html)** · **[Spec](./SPEC.md)** · **[GitHub](https://github.com/Dr-Agentic/ringtalk)**

---

## What it does

RingTalk is a gateway that turns RingEX Team Messaging into a native surface for AI agents.

- Users @mention `@research-agent`, `@coding-agent`, or `@ops-agent` in any RingEX channel or DM
- The gateway routes the message to the correct agent runtime (Hermes, Codex, or custom)
- The agent responds in the same RingEX thread — text, files, citations, status updates
- Agents remember conversation history via RingEX thread context
- Agents proactively reach into channels: digests, alerts, reminders

**The RingEX interface is stable.** Agent runtimes are pluggable and replaceable without changing how users interact.

---

## Quick Start

### 1. Prerequisites

```bash
node --version  # >= 20
ngrok           # for local webhook testing
```

### 2. Clone & install

```bash
git clone https://github.com/Dr-Agentic/ringtalk.git
cd ringtalk
npm install
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env with your RingCentral credentials (see § RingCentral App Setup below)
```

### 4. Test without an API key (Echo adapter)

```bash
npm run dev
# Bot is running — send it a DM in RingEX
# It echoes back your message, confirming the full loop works
```

### 5. Connect a real agent

```bash
# Research agent (Hermes):
HERMES_URL=http://localhost:2222
HERMES_API_KEY=your_key

# Coding agent (OpenAI Codex):
CODEX_API_KEY=sk-...

npm run dev
```

---

# Pre-push checklist
```bash
npm run lint && npm run typecheck && npm test -- --run && npm run dev:docker
```

## Architecture

```
RingEX user @mentions @research-agent
        │
        ▼
┌─────────────────────┐
│   RingEX Webhook    │ ← ngrok / Cloudflare Tunnel (dev)
│ POST /webhook/ringex│   your-domain.com/webhook/ringex (prod)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│   RingEX Adapter    │ Validates signature, extracts
│ src/ringex/         │ groupId, senderId, text, mentions
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│   Agent Gateway     │ Routes to the right agent adapter
│ src/gateway/        │ by @mention name. Maintains session.
└──────────┬──────────┘
           ▼
┌──────────────────────────────────────┐
│         Agent Adapters               │
│  HermesAdapter  │ CodexAdapter  │ ...│
└──────────┬─────────────────────────────┘
           ▼
┌─────────────────────┐
│  RingEX Adapter     │ Sends response back to thread
└──────────┬──────────┘
           ▼
RingEX thread ← agent reply
```

Full spec: [SPEC.md](./SPEC.md)

---

## Agents

| Agent | Runtime | Example use |
|---|---|---|
| `@research-agent` | Hermes (local/remote) | Competitive analysis, briefs, literature review, content drafting |
| `@coding-agent` | OpenAI Codex | PR review, bug investigation, CI/CD diagnostics, release coordination |
| `@ops-agent` | Hermes + internal tools | KPI digests, reminders, CRM sync, workflow approvals |
| `@echo-agent` | Built-in | Development only — echoes your message back |

---

## RingCentral App Setup

1. Create a RingCentral app at [developers.ringcentral.com](https://developers.ringcentral.com)
2. **App type:** Server/Bot (JWT auth)
3. **Required scopes:** `Glip`, `Webhook`, `Bot`
4. **Set the webhook URL** in the app dashboard:
   - Dev: your ngrok URL (e.g. `https://abc123.ngrok.io/webhook/ringex`)
   - Prod: your public domain (e.g. `https://ringtalk.your-domain.com/webhook/ringex`)
5. **Create a bot extension** — this becomes `@research-agent`, `@coding-agent`, etc.
6. **Generate a JWT token** for the bot → set as `RINGEX_BOT_JWT` in `.env`

---

## Deployment

### Docker (recommended)

```bash
docker build -t ringtalk .
docker run --env-file .env -p 3000:3000 ringtalk
```

### Docker Compose (with ngrok tunnel)

```bash
cp .env.example .env
# Add your RingCentral credentials + ngrok authtoken
docker-compose up -d
```

### Production (Cloudflare Tunnel)

```bash
# 1. Point a subdomain to this server
# 2. Set RINGEX_WEBHOOK_URL=https://ringtalk.your-domain.com
# 3. Deploy: Railway, Hetzner, Render, Fly.io — any Node.js host
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhook/ringex` | RingEX sends events here |
| `GET` | `/health` | Liveness check |
| `GET` | `/ready` | Readiness check (RingEX auth + session store) |
| `GET` | `/admin/sessions` | List active sessions |
| `DELETE` | `/admin/sessions/:id` | Kill a session |

---

## Environment Variables

See [`.env.example`](.env.example) for all variables. Key ones:

| Variable | Description |
|---|---|
| `RINGEX_BOT_JWT` | Bot JWT from RingCentral app |
| `RINGEX_WEBHOOK_SECRET` | Random secret for HMAC validation |
| `RINGEX_WEBHOOK_URL` | Public URL of this server (for webhook registration) |
| `HERMES_URL` | Hermes gateway URL (default: `http://localhost:2222`) |
| `CODEX_API_KEY` | OpenAI API key for Codex agent |

---

## Project Structure

```
src/
├── index.ts           # Express app, webhook handler, admin routes
├── ringex/
│   ├── client.ts      # RingEX SDK client factory
│   ├── webhook.ts     # HMAC validation + event parsing
│   └── sender.ts      # sendMessage, sendTyping, sendCard, sendResponse
├── gateway/
│   ├── router.ts      # Routes messages to the right agent
│   ├── registry.ts    # Agent name → adapter mapping
│   └── session.ts     # In-memory session store
├── agents/
│   ├── echo.ts        # Development echo adapter
│   ├── hermes.ts      # Research → Hermes gateway
│   ├── codex.ts       # Coding → OpenAI Codex
│   └── ops.ts         # Ops → Hermes + internal tools
└── types/
    └── index.ts       # Shared type definitions
```

---

## License

MIT
