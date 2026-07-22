import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import { validateWebhookSignature, parseRingEXEvent, stripMentions } from './ringex/webhook.js';
import { createRingEXClient } from './ringex/client.js';
import { buildRegistry, InMemorySessionStore, Router } from './gateway/index.js';
import type { MessageEnvelope } from './types/index.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3000;
const WEBHOOK_SECRET = process.env.RINGEX_WEBHOOK_SECRET ?? '';
const NODE_ENV = process.env.NODE_ENV ?? 'development';

const app = express();

// Raw body needed for HMAC signature validation
app.use('/webhook/ringex', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── Dependencies ───────────────────────────────────────────────────────────────

const { sdk, sender } = createRingEXClient();
const sessions = new InMemorySessionStore();
const registry = await buildRegistry();
const router = new Router(registry, sessions, sender);

console.log('[RingTalk] Agents registered:', registry.list().map((a) => a.name).join(', '));

// ── Webhook handler ───────────────────────────────────────────────────────────

app.post('/webhook/ringex', async (req: Request, res: Response) => {
  const signature = req.headers['x-glip-signature'] as string | undefined;
  const rawBody = req.body as Buffer;

  // Validate signature
  if (WEBHOOK_SECRET && !validateWebhookSignature(rawBody, signature, WEBHOOK_SECRET)) {
    console.warn('[Webhook] Invalid signature — rejecting');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event = parseRingEXEvent(body);
  if (!event) {
    return res.status(200).json({ status: 'skipped' });
  }

  if (event.type !== 'Message4Bot') {
    return res.status(200).json({ status: 'skipped' });
  }

  const { cleanText, mentionedAgents } = stripMentions(event.text);

  const envelope: MessageEnvelope = {
    chatId: event.chatId,
    threadId: event.chatId,
    senderId: event.from.id,
    senderName: event.from.name,
    mentionedAgents,
    text: cleanText,
    rawEvent: event,
    sessionId: `${event.chatId}:${mentionedAgents[0] ?? 'unknown'}`,
    timestamp: event.creationTime,
  };

  res.status(200).json({ status: 'received' });

  router.route(envelope).catch((err) => {
    console.error('[Webhook] Route error:', err);
  });
});

// ── Health endpoints ───────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', env: NODE_ENV, ts: new Date().toISOString() });
});

app.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = { env: 'ok' };

  try {
    await sdk.platform().get('/restapi/v1.0/glip/persons/~');
    checks.ringex = 'ok';
  } catch {
    checks.ringex = 'auth_error';
  }

  checks.sessionStore = 'ok';

  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({ checks });
});

// ── Admin endpoints ───────────────────────────────────────────────────────────

app.get('/admin/sessions', (_req: Request, res: Response) => {
  const all = sessions.listAll();
  res.json({ count: all.length, sessions: all.map((s) => ({
    id: s.id,
    chatId: s.chatId,
    agentName: s.agentName,
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt,
    historyLength: s.context.history.length,
  })) });
});

app.delete('/admin/sessions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const [chatId, agentName] = id.split(':');
  if (!chatId || !agentName) {
    return res.status(400).json({ error: 'Invalid session ID format — expected chatId:agentName' });
  }
  const deleted = sessions.delete(chatId, agentName);
  res.json({ deleted });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`[RingTalk] Server running on port ${PORT} (${NODE_ENV})`);
  console.log(`[RingTalk] Webhook: POST http://localhost:${PORT}/webhook/ringex`);
  console.log(`[RingTalk] Health:  GET  http://localhost:${PORT}/health`);
});

process.on('SIGTERM', () => {
  console.log('[RingTalk] SIGTERM — shutting down');
  server.close(() => process.exit(0));
});
