/**
 * LlmAdapter — OpenRouter-backed agent for development / emulator use.
 * Wire into the real bot (not just emulator) by setting OPENROUTER_API_KEY + ADAPTER=llm.
 *
 * Usage (emulator):
 *   OPENROUTER_API_KEY=sk-or-... npm run emulator
 *
 * Usage (production @llm-agent):
 *   OPENROUTER_API_KEY=sk-or-... ADAPTER=llm npm run dev
 *
 * Models: set OPENROUTER_MODEL (default: openrouter/auto — routes to cheapest available).
 * Free tier: openrouter.ai → free credits on signup.
 */

import { AgentAdapter, type AgentResponse, type MessageEnvelope } from '../types/index.js';

export interface LlmAdapterOptions {
  /** OpenRouter API key from https://openrouter.ai/keys */
  apiKey: string;
  /** Model to use. Defaults to openrouter/auto (cheapest). */
  model?: string;
  /** Base URL for OpenRouter API. Defaults to https://openrouter.ai/api/v1 */
  baseUrl?: string;
  /** Optional system prompt injected before every user message */
  systemPrompt?: string;
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterChoice {
  message: { role: string; content: string };
  finish_reason?: string;
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
  error?: { message: string; code: string };
}

export class LlmAdapter implements AgentAdapter {
  name = 'llm-agent';
  description = 'General-purpose LLM agent backed by OpenRouter';
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private systemPrompt: string;

  constructor(opts: LlmAdapterOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? 'openrouter/auto';
    this.baseUrl = opts.baseUrl ?? 'https://openrouter.ai/api/v1';
    this.systemPrompt =
      opts.systemPrompt ??
      'You are @llm-agent, a helpful AI assistant running inside RingTalk. ' +
        'You have access to no external tools in this environment. ' +
        'Reply concisely and helpfully to the user.';
  }

  /**
   * Build the OpenRouter message list from the session history + current prompt.
   */
  private buildMessages(envelope: MessageEnvelope): OpenRouterMessage[] {
    const msgs: OpenRouterMessage[] = [{ role: 'system', content: this.systemPrompt }];

    // If the session has prior history, include it for context continuity
    if (envelope.sessionHistory && envelope.sessionHistory.length > 0) {
      for (const msg of envelope.sessionHistory) {
        msgs.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
      }
    }

    // Current user message
    msgs.push({ role: 'user', content: envelope.text });
    return msgs;
  }

  /**
   * POST to OpenRouter /chat/completions and return the assistant's reply.
   */
  private async chat(messages: OpenRouterMessage[]): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const body = {
      model: this.model,
      messages,
      // Let OpenRouter handle streaming on their end; we collect the full response
      stream: false,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://ringtalk.dev',
        'X-Title': 'RingTalk Emulator',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`OpenRouter HTTP ${response.status}: ${errBody}`);
    }

    const data = (await response.json()) as OpenRouterResponse;

    if (data.error) {
      throw new Error(`OpenRouter error ${data.error.code}: ${data.error.message}`);
    }

    const choice = data.choices[0];
    return choice?.message?.content ?? '';
  }

  async handle(envelope: MessageEnvelope): Promise<AgentResponse> {
    const messages = this.buildMessages(envelope);

    try {
      const text = await this.chat(messages);
      return {
        text,
        agent: this.name,
        model: this.model,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        text: '',
        error: `LLM error: ${message}`,
        agent: this.name,
      };
    }
  }
}

/** Create a LlmAdapter from environment variables. Returns null if OPENROUTER_API_KEY is not set. */
export function createLlmAdapterFromEnv(): LlmAdapter | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  return new LlmAdapter({
    apiKey,
    model: process.env.OPENROUTER_MODEL,
    baseUrl: process.env.OPENROUTER_BASE_URL,
    systemPrompt: process.env.OPENROUTER_SYSTEM_PROMPT,
  });
}
