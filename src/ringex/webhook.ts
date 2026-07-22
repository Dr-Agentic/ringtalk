import crypto from 'crypto';
import type { RingEXEvent, RingEXMessageEvent } from '../types/index.js';

// ── Webhook signature validation ─────────────────────────────────────────────

/**
 * RingEX webhooks include an X-Glip-Signature header with HMAC-SHA256
 * of the raw request body, using RINGEX_WEBHOOK_SECRET as the key.
 */
export function validateWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature),
  );
}

// ── Event parsing ─────────────────────────────────────────────────────────────

export function parseRingEXEvent(body: unknown): RingEXEvent | null {
  const event = body as Record<string, unknown>;

  // RingEX wraps events in an 'event' key
  const inner = (event.event ?? event) as Record<string, unknown>;
  const type = String(inner.type ?? '');

  if (type === 'Message4Bot' || type === 'messages') {
    return parseMessageEvent(inner as Record<string, unknown>);
  }

  if (type === 'GroupUpdated' || type === 'GroupAdded' || type === 'GroupRemoved') {
    return parseGroupUpdatedEvent(inner as Record<string, unknown>);
  }

  // Unhandled event type — log and skip
  return null;
}

function parseMessageEvent(e: Record<string, unknown>): RingEXMessageEvent {
  const from = e.from as Record<string, unknown> | undefined;
  const sender = e.sender as Record<string, unknown> | undefined;
  const creator = e.creatorId ?? sender?.id ?? '';

  // Mentions may be in 'mentions' array or embedded in text
  const rawMentions = (e.mentions as Array<{ id?: string; name?: string }> | undefined) ?? [];
  const mentionedAgents: string[] = rawMentions
    .map((m) => (m.name ?? '').replace('@', '').trim())
    .filter(Boolean);

  // Fallback: extract @mentions from text directly
  const text = String(e.text ?? e.body ?? '');
  const textMentions = [...text.matchAll(/@([\w-]+)/g)].map((m) => m[1]);
  const allMentions = [...new Set([...mentionedAgents, ...textMentions])];

  return {
    type: 'Message4Bot',
    chatId: String(e.chatId ?? e.groupId ?? ''),
    chatType: (e.chatType as 'Direct' | 'Group') ?? 'Direct',
    from: {
      id: String(from?.id ?? sender?.id ?? creator ?? ''),
      name: String(from?.name ?? sender?.name ?? from?.id ?? sender?.id ?? ''),
    },
    text,
    mentions: allMentions,
    groupId: e.groupId ? String(e.groupId) : undefined,
    creatorId: String(creator),
    creationTime: String(e.creationTime ?? e.timestamp ?? new Date().toISOString()),
    attachments: e.attachments as RingEXMessageEvent['attachments'],
  };
}

function parseGroupUpdatedEvent(e: Record<string, unknown>): RingEXEvent {
  return {
    type: 'GroupUpdated',
    groupId: String(e.groupId ?? e.id ?? ''),
    chatType: (e.chatType as 'Direct' | 'Group') ?? 'Group',
    membersAdded: (e.membersAdded as string[] | undefined) ?? [],
    membersRemoved: (e.membersRemoved as string[] | undefined) ?? [],
    timestamp: String(e.timestamp ?? new Date().toISOString()),
  };
}

// ── Mention extraction ─────────────────────────────────────────────────────────

/**
 * Strip @mentions and clean up message text before passing to an agent.
 * Returns { cleanText, mentionedAgents }
 */
export function stripMentions(text: string): { cleanText: string; mentionedAgents: string[] } {
  const mentions: string[] = [];
  const clean = text.replace(/@([\w-]+)/g, (_, name) => {
    mentions.push(name.trim());
    return '';
  }).trim();
  return { cleanText: clean, mentionedAgents: mentions };
}
