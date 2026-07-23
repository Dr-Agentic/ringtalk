import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySessionStore } from './session.js';

describe('InMemorySessionStore', () => {
  let store: InMemorySessionStore;

  beforeEach(() => {
    store = new InMemorySessionStore();
  });

  it('creates a session on first access', () => {
    const session = store.get('chat-1', 'research-agent');
    expect(session).toBeUndefined();
  });

  it('creates and returns a session with set()', () => {
    const session = store.set('chat-1', 'research-agent');
    expect(session).toBeDefined();
    expect(session.chatId).toBe('chat-1');
    expect(session.agentName).toBe('research-agent');
    expect(session.id).toBe('chat-1:research-agent');
  });

  it('returns existing session on second access', () => {
    const s1 = store.set('chat-1', 'research-agent');
    const s2 = store.get('chat-1', 'research-agent');
    expect(s2).toBeDefined();
    expect(s2?.id).toBe(s1.id);
  });

  it('stores session history', () => {
    store.appendMessage('chat-1', 'research-agent', 'msg-1', 'user', 'Hello');
    store.appendMessage('chat-1', 'research-agent', 'msg-2', 'agent', 'Hi there');
    const session = store.get('chat-1', 'research-agent');
    expect(session?.context.history).toHaveLength(2);
    expect(session?.context.history[0].role).toBe('user');
    expect(session?.context.history[1].role).toBe('agent');
  });

  it('isolates sessions by chatId', () => {
    store.set('chat-1', 'research-agent');
    store.set('chat-2', 'coding-agent');
    const sessions = store.listAll();
    expect(sessions).toHaveLength(2);
    expect(sessions.map(s => s.chatId)).toContain('chat-1');
    expect(sessions.map(s => s.chatId)).toContain('chat-2');
  });

  it('deletes a session', () => {
    store.set('chat-1', 'research-agent');
    const deleted = store.delete('chat-1', 'research-agent');
    expect(deleted).toBe(true);
    expect(store.get('chat-1', 'research-agent')).toBeUndefined();
  });

  it('clear removes all sessions', () => {
    store.set('chat-1', 'research-agent');
    store.set('chat-2', 'coding-agent');
    store.clear();
    expect(store.listAll()).toHaveLength(0);
  });

  it('session key is chatId:agentName', () => {
    const session = store.set('abc', 'research-agent');
    expect(session.id).toBe('abc:research-agent');
  });
});
