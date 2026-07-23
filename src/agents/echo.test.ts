import { describe, it, expect } from 'vitest';
import { EchoAdapter } from './echo.js';

describe('EchoAdapter', () => {
  const adapter = new EchoAdapter();

  const makeReq = (text: string) => ({
    chatId: 'chat-1',
    threadId: 'chat-1',
    senderId: 'user-1',
    senderName: 'Morsy',
    mentionedAgents: ['echo-agent'],
    text,
    rawEvent: { type: 'Message4Bot', chatId: 'chat-1', chatType: 'Direct', from: { id: 'user-1', name: 'Morsy' }, text, mentions: ['echo-agent'], creatorId: 'user-1', creationTime: new Date().toISOString() },
    sessionId: 'chat-1:echo-agent',
    timestamp: new Date().toISOString(),
  });

  it('returns a text response', async () => {
    const res = await adapter.handle(makeReq('Hello world'));
    expect(res.text).toContain('Echo from @echo-agent');
    expect(res.text).toContain('Hello world');
  });

  it('includes a status message', async () => {
    const res = await adapter.handle(makeReq('test'));
    expect(res.status).toBeDefined();
  });

  it('has correct name and description', () => {
    expect(adapter.name).toBe('echo-agent');
    expect(adapter.description).toContain('development');
  });
});
