# RingTalk — Specification

**Version:** 0.1.0 · July 2026
**Status:** Ready for API key — awaiting RingCentral credentials to test end-to-end

---

## 1. Concept & Vision

RingTalk turns RingEX Team Messaging into a native surface for AI agents. Instead of context-switching to a separate AI product, users @mention a teammate — `@research-agent`, `@coding-agent`, `@ops-agent` — and get expert-level work done directly in the RingEX thread. The agent is a named, addressable member of the team. Thread history is agent memory. The platform is RingEX.

The gateway is intentionally thin: it routes messages and responses between RingEX and any agent runtime. The agent runtime is pluggable — Hermes, Codex, an internal service — without any change to how users interact with it.

---

## 2. Design Principles

| Principle | Implication |
|---|---|
| **Agents are teammates** | Each agent has a RingEX bot identity, a name, and responds only to @mentions — no ambient listening |
| **Thread is memory** | Full conversation history is preserved per RingEX thread; agents use it as long-term context |
| **Proactive by default** | Agents reach into channels on their own schedule: digests, alerts, reminders |
| **Gateway is dumb, agents are smart** | The gateway routes, translates, and delivers. Agents think, synthesize, and act |
| **Replaceable internals** | RingEX interface is stable. Agent runtimes can evolve, upgrade, or swap without changing user behavior |

---

## 3. Architecture

```
RingEX user @mentions @research-agent
        │
        ▼
┌─────────────────────┐
│   RingEX Webhook    │ ← ngrok / Cloudflare Tunnel (dev)
│ POST /webhook/ringex│   POST /webhook/ringex (prod)
└──────────┬──────────┘
           │ event: Message4Bot / GroupUpdated
           ▼
┌─────────────────────┐
│   RingEX Adapter    │ Validates signature, extracts
│ src/ringex/         │ groupId, senderId, text, mentions
└──────────┬──────────┘
           │ MessageEnvelope
           ▼
┌─────────────────────┐
│   Agent Gateway     │ Routes to the right agent adapter
│ src/gateway/        │ by @mention name. Maintains session
└──────────┬──────────┘   (RingEX thread ↔ agent session)
           │ AgentRequest
           ▼
┌──────────────────────────────────────────┐
│         Agent Adapters (pluggable)       │
│  hermes  │  codex  │  ops  │ custom...  │
└──────────┬─────────────────────────────────┘
           │ AgentResponse (text, files, status)
           ▼
┌─────────────────────┐
│  RingEX Adapter     │ Translates response to RingEX
│ src/ringex/         │ markdown, streams typing indicator,
└──────────┬──────────┘ sends message back to thread
           │ bot.sendMessage(groupId, ...)
           ▼
RingEX thread ← agent reply appears
```

---

## 4. Components

### 4.1 RingEX Adapter (`src/ringex/`)

**Responsibility:** Receive webhook events, send replies, manage presence.

**Files:**
- `client.ts` — RingEX SDK client (from `@ringcentral/sdk`)
- `webhook.ts` — Webhook signature validation + event parsing
- `sender.ts` — `sendMessage()`, `sendTyping()`, `sendCard()`
- `types.ts` — RingEX event shapes

**Webhook Events Handled:**
| Event | Action |
|---|---|
| `POST /webhook/ringex` | Receive all bot events |
| `Message4Bot` | Direct message to a bot — route to gateway |
| `GroupUpdated` | Bot added to / removed from a group |
| `TeamMeeting Started` | (future) meeting intelligence |

**Message Sending:**
- Text: plain markdown → RingEX Markdown v1
- Files: attach via `bot.sendMedia`
- Status: send a separate "progress" message, edit it as work continues
- Cards: Adaptive Card / structured card via `sendCard()`

### 4.2 Agent Gateway (`src/gateway/`)

**Responsibility:** Route messages to the correct agent, maintain session state.

**Files:**
- `router.ts` — Maps `@agent-name` → `AgentAdapter` instance
- `session.ts` — `SessionStore` interface; in-memory impl + Redis-ready interface
- `registry.ts` — `AgentRegistry`: registers agents by name, holds capabilities + adapter ref
- `envelope.ts` — `MessageEnvelope` — normalized request shape passed to agents

**Session:**
- Key: `${chatId}:${agentName}` — one session per agent per RingEX thread
- TTL: configurable (default 7 days of inactivity)
- Store: `Map<string, Session>` in-memory for MVP; swap for Redis in prod

### 4.3 Agent Adapters (`src/agents/`)

Each adapter implements `AgentAdapter`:
```typescript
interface AgentAdapter {
  name: string;           // '@research-agent'
  description: string;    // shown in RingEX contact card
  handle(req: MessageEnvelope): Promise<AgentResponse>;
}
```

| Adapter | Runtime | Capability |
|---|---|---|
| `HermesAdapter` | Hermes Agent (local / remote) | Research, synthesis, briefs, web search |
| `CodexAdapter` | OpenAI Codex CLI | Code review, bug investigation, releases |
| `OpsAdapter` | Hermes + internal tools | Follow-ups, CRM sync, KPI digests, alerts |
| `EchoAdapter` | Built-in | Development-only: echoes the request back — no API key needed |

### 4.4 Shared Types (`src/types/`)

```typescript
interface MessageEnvelope {
  chatId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  mentionedAgents: string[];   // ['@research-agent']
  text: string;                // stripped message content
  rawEvent: RingEXEvent;
  sessionId: string;            // `${chatId}:${agentName}`
}

interface AgentResponse {
  text: string;
  files?: Media[];
  status?: string;              // 'Researching 14 sources…'
  citations?: Citation[];
  actions?: AgentAction[];      // e.g. { type: 'create_reminder', params: {...} }
  streaming?: boolean;
}

interface AgentAction {
  type: 'send_message' | 'create_reminder' | 'update_crm' | 'book_meeting';
  params: Record<string, unknown>;
}
```

---

## 5. Configuration

**Environment Variables:**
```bash
# RingEX / RingCentral
RINGEX_CLIENT_ID=          # RingCentral app Client ID
RINGEX_CLIENT_SECRET=      # RingCentral app Client Secret
RINGEX_SERVER_URL=         # https://platform.ringcentral.com (prod) or sandbox
RINGEX_BOT_JWT=            # Bot JWT token from RingCentral app
RINGEX_WEBHOOK_SECRET=     # for HMAC signature validation
RINGEX_WEBHOOK_URL=        # https://your-domain.com/webhook/ringex

# Agent runtimes
HERMES_URL=                # http://localhost:2222 (local Hermes)
HERMES_API_KEY=            # if Hermes requires auth
CODEX_API_KEY=             # OpenAI API key for Codex CLI

# App
LOG_LEVEL=info             # debug | info | warn | error
SESSION_TTL_DAYS=7
PORT=3000
NODE_ENV=development
```

---

## 6. API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhook/ringex` | RingEX sends events here |
| `GET` | `/health` | Liveness check |
| `GET` | `/ready` | Readiness check — RingEX client + session store |
| `POST` | `/admin/sessions` | List active sessions (admin) |
| `DELETE` | `/admin/sessions/:id` | Kill a session (admin) |

---

## 7. Development Workflow

### 7.1 Prerequisites
```bash
node --version  # >= 20
npm --version
ngrok or Cloudflare Tunnel  # for local webhook testing
```

### 7.2 Local Setup
```bash
npm install
cp .env.example .env
# Fill in RINGEX_* vars from your RingCentral app
# For local dev without a real bot: ADAPTER=echo npm run dev

npm run dev          # ts-node-dev, hot reload on port 3000
npm run dev:ngrok    # starts ngrok tunnel + dev server
```

### 7.3 Testing the Echo Adapter (no API key needed)
```bash
ADAPTER=echo npm run dev
# Send a DM to your bot in RingEX
# Bot should echo back your message
```

### 7.4 ngrok Setup
```bash
ngrok http 3000
# Copy the https://forwarding-url, paste into RingCentral app webhook URL
```

---

## 8. Deployment

### 8.1 Docker (recommended)
```bash
docker build -t ringtalk .
docker run --env-file .env ringtalk
```

### 8.2 Docker Compose (with ngrok for dev)
```bash
docker-compose up
```

### 8.3 Production
```bash
# Deploy webhook endpoint behind a public HTTPS URL
# Options: Cloudflare Tunnel, Railway, Hetzner, Render

# Set RINGEX_WEBHOOK_URL to your public endpoint
# Register the webhook URL in your RingCentral app dashboard
```

---

## 9. RingCentral App Setup

1. Create a RingCentral app at [developers.ringcentral.com](https://developers.ringcentral.com)
2. App type: **Server/Bot** (JWT auth)
3. Required scopes:
   - `Glip` — access to Team Messaging
   - `Webhook` — subscribe to events
   - `Bot` — act as a bot
4. Set the webhook URL in the app dashboard pointing to `https://your-domain.com/webhook/ringex`
5. Create a bot extension — this becomes `@research-agent`, `@coding-agent`, etc.
6. Generate a JWT token for the bot
7. Set `RINGEX_BOT_JWT` in `.env`

---

## 10. Security Considerations

- **Webhook signature validation:** Every incoming `POST /webhook/ringex` is HMAC-SHA256 validated with `RINGEX_WEBHOOK_SECRET`
- **Tenant isolation:** `chatId` + `senderId` scope all operations; no cross-tenant data leaks
- **Bot token:** JWT used only server-side; never exposed to client
- **Agent actions:** External actions (CRM write, calendar booking) require explicit user confirmation before execution

---

## 11. Future Phases

| Phase | Description |
|---|---|
| **v0.2** | Streaming replies — agent "typing" indicator while processing |
| **v0.3** | Agent directory UI in RingEX — discovery browseable list |
| **v0.4** | Multi-agent handoff — one agent calls another in the same thread |
| **v1.0** | Redis session store, observability (traces, metrics), production deployment |
