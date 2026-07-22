import type { AgentAdapter, AgentResponse, MessageEnvelope } from '../types/index.js';

/**
 * EchoAdapter — development-only adapter.
 * Echoes back the user's message with a timestamp.
 * No API key needed. Used to test the full RingEX → gateway → agent → RingEX loop.
 */
export class EchoAdapter implements AgentAdapter {
  name = 'echo-agent';
  description = 'Echoes back your message — development only';

  async handle(req: MessageEnvelope): Promise<AgentResponse> {
    const ts = new Date().toISOString();
    return {
      text: `**Echo from @echo-agent**\n\nI received your message at ${ts}:\n\n> ${req.text}\n\nI'm working! The RingTalk gateway is routing correctly.`,
      status: 'Replied successfully',
    };
  }
}
