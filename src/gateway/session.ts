import type { Session, SessionContext } from '../types/index.js';

const TTL_MS = (Number(process.env.SESSION_TTL_DAYS) || 7) * 24 * 60 * 60 * 1000;

/**
 * In-memory session store.
 * Swap this for a Redis implementation in production.
 */
export class InMemorySessionStore {
  private sessions = new Map<string, Session>();

  private key(chatId: string, agentName: string): string {
    return `${chatId}:${agentName}`;
  }

  get(chatId: string, agentName: string): Session | undefined {
    const session = this.sessions.get(this.key(chatId, agentName));
    if (!session) return undefined;

    // Expire stale sessions
    if (Date.now() - session.lastActiveAt.getTime() > TTL_MS) {
      this.sessions.delete(this.key(chatId, agentName));
      return undefined;
    }
    return session;
  }

  set(chatId: string, agentName: string, partial?: Partial<SessionContext>): Session {
    const id = this.key(chatId, agentName);
    const now = new Date();

    const existing = this.sessions.get(id);
    const session: Session = {
      id,
      chatId,
      agentName,
      createdAt: existing?.createdAt ?? now,
      lastActiveAt: now,
      context: {
        history: existing?.context.history ?? [],
        ...partial,
      },
    };

    this.sessions.set(id, session);
    return session;
  }

  appendMessage(
    chatId: string,
    agentName: string,
    messageId: string,
    role: 'user' | 'agent',
    content: string,
  ): void {
    const session = this.get(chatId, agentName) ?? this.set(chatId, agentName);
    session.lastActiveAt = new Date();
    session.context.history.push({
      messageId,
      role,
      content,
      timestamp: new Date(),
    });
  }

  listAll(): Session[] {
    return [...this.sessions.values()];
  }

  delete(chatId: string, agentName: string): boolean {
    return this.sessions.delete(this.key(chatId, agentName));
  }

  clear(): void {
    this.sessions.clear();
  }

  get history(): Map<string, Session> {
    return this.sessions;
  }
}
