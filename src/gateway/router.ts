import type { AgentAdapter, AgentResponse, MessageEnvelope } from '../types/index.js';
import { AgentRegistry } from './registry.js';
import { InMemorySessionStore } from './session.js';
import type { RingEXSender } from '../ringex/index.js';

/**
 * The Router receives a parsed MessageEnvelope from the RingEX adapter,
 * resolves the mentioned agent, fetches session context, calls the agent,
 * and streams the response back to RingEX.
 */
export class Router {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly sessions: InMemorySessionStore,
    private readonly sender: RingEXSender,
  ) {}

  /**
   * Route an incoming message to the right agent and send the response.
   * Returns the session ID on success, null on failure.
   */
  async route(env: MessageEnvelope): Promise<string | null> {
    const { mentionedAgents, chatId, senderName, senderId } = env;

    if (mentionedAgents.length === 0) {
      // No agent mentioned — nothing to route
      return null;
    }

    // Handle first mentioned agent only (simplifies multi-agent for MVP)
    const agentName = mentionedAgents[0];
    const adapter = this.registry.get(agentName);

    if (!adapter) {
      console.warn(`[Router] No agent registered for: @${agentName}`);
      await this.sender.sendMessage(
        chatId,
        `I don't have an agent called @${agentName}. Try: @research-agent, @coding-agent, or @ops-agent.`,
      );
      return null;
    }

    const sessionId = `${chatId}:${agentName}`;

    // Initialize or resume session
    const session = this.sessions.set(chatId, agentName);

    // Append user message to session history
    this.sessions.appendMessage(
      chatId,
      agentName,
      `user-${Date.now()}`,
      'user',
      env.text,
    );

    // Show typing indicator
    await this.sender.sendTyping(chatId);

    // Call the agent
    let response: AgentResponse;
    try {
      response = await adapter.handle(env);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Router] Agent @${agentName} threw:`, message);
      response = { text: '', error: `Agent error: ${message}` };
    }

    // Append agent response to session history
    this.sessions.appendMessage(
      chatId,
      agentName,
      `agent-${Date.now()}`,
      'agent',
      response.text,
    );

    // Send response to RingEX
    await this.sender.sendResponse(chatId, response);

    console.log(
      `[Router] ${senderName} → @${agentName} (${chatId}) → ${response.error ? 'ERROR' : 'OK'}`,
    );

    return sessionId;
  }

  /**
   * Send a proactive message from an agent to a RingEX chat.
   * Used for: scheduled digests, alerts, reminders.
   */
  async sendProactive(
    chatId: string,
    agentName: string,
    text: string,
    sessionId?: string,
  ): Promise<void> {
    const adapter = this.registry.get(agentName);
    if (!adapter) {
      console.warn(`[Router] No agent @${agentName} for proactive message`);
      return;
    }

    // Create a synthetic envelope for proactive agent calls
    const proactiveEnv: MessageEnvelope = {
      chatId,
      threadId: chatId,
      senderId: 'system',
      senderName: 'RingTalk System',
      mentionedAgents: [agentName],
      text,
      rawEvent: { type: 'Message4Bot', chatId, chatType: 'Group', from: { id: 'system', name: 'System' }, text, mentions: [agentName], creatorId: 'system', creationTime: new Date().toISOString() },
      sessionId: sessionId ?? `${chatId}:${agentName}`,
      timestamp: new Date().toISOString(),
    };

    const response = await adapter.handle(proactiveEnv);
    await this.sender.sendResponse(chatId, response);
  }
}
