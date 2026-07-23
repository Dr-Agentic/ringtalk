import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  stripMentions,
  validateWebhookSignature,
  parseRingEXEvent,
} from '../ringex/webhook.js';

describe('stripMentions', () => {
  it('removes @mentions and returns agent names', () => {
    const { cleanText, mentionedAgents } = stripMentions(
      'Hey @research-agent can you look at the Acme Corp brief?',
    );
    expect(cleanText).toBe('Hey can you look at the Acme Corp brief?');
    expect(mentionedAgents).toContain('research-agent');
  });

  it('handles multiple mentions', () => {
    const { cleanText, mentionedAgents } = stripMentions(
      '@research-agent compare @coding-agent output for the auth module',
    );
    expect(cleanText).toBe('compare output for the auth module');
    expect(mentionedAgents).toContain('research-agent');
    expect(mentionedAgents).toContain('coding-agent');
  });

  it('returns empty arrays when no mentions', () => {
    const { cleanText, mentionedAgents } = stripMentions('Just a plain message');
    expect(cleanText).toBe('Just a plain message');
    expect(mentionedAgents).toHaveLength(0);
  });

  it('trims whitespace from cleaned text', () => {
    const { cleanText } = stripMentions('@research-agent  brief the Q2 numbers');
    expect(cleanText).toBe('brief the Q2 numbers');
  });
});

describe('validateWebhookSignature', () => {
  const secret = 'test-secret-123';

  it('returns true for a valid HMAC-SHA256 signature', () => {
    const body = Buffer.from('{"type":"Message4Bot"}');
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const result = validateWebhookSignature(body, expected, secret);
    expect(result).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    const body = Buffer.from('{"type":"Message4Bot"}');
    const result = validateWebhookSignature(body, 'invalid-signature', secret);
    expect(result).toBe(false);
  });

  it('returns false when signature is undefined', () => {
    const body = Buffer.from('{"type":"Message4Bot"}');
    const result = validateWebhookSignature(body, undefined, secret);
    expect(result).toBe(false);
  });
});

describe('parseRingEXEvent', () => {
  it('parses a Message4Bot event', () => {
    const body = {
      type: 'Message4Bot',
      chatId: 'chat-123',
      chatType: 'Direct',
      from: { id: 'user-456', name: 'Morsy' },
      text: 'Hey @research-agent look at this',
      mentions: [{ id: 'bot-789', name: '@research-agent' }],
      creatorId: 'user-456',
      creationTime: '2026-07-22T10:00:00Z',
    };

    const event = parseRingEXEvent(body);
    expect(event).not.toBeNull();
    expect(event?.type).toBe('Message4Bot');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((event as any).chatId).toBe('chat-123');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((event as any).from.name).toBe('Morsy');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((event as any).text).toContain('@research-agent');
  });

  it('extracts mentions from text when mentions array is empty', () => {
    const body = {
      type: 'Message4Bot' as const,
      chatId: 'chat-123',
      chatType: 'Group' as const,
      from: { id: 'user-456', name: 'Morsy' },
      text: '@coding-agent review PR #42',
      mentions: [],
      creatorId: 'user-456',
      creationTime: '2026-07-22T10:00:00Z',
    };

    const event = parseRingEXEvent(body);
    expect(event).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((event as any).mentions).toContain('coding-agent');
  });

  it('parses a GroupUpdated event', () => {
    const body = {
      type: 'GroupUpdated' as const,
      groupId: 'group-123',
      chatType: 'Group' as const,
      membersAdded: ['user-1', 'user-2'],
      membersRemoved: ['user-3'],
      timestamp: '2026-07-22T10:00:00Z',
    };

    const event = parseRingEXEvent(body);
    expect(event).not.toBeNull();
    expect(event?.type).toBe('GroupUpdated');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((event as any).membersAdded).toHaveLength(2);
  });

  it('returns null for unknown event types', () => {
    const body = { type: 'UnknownEvent', data: 'something' };
    const event = parseRingEXEvent(body);
    expect(event).toBeNull();
  });
});
