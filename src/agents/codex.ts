import type { AgentAdapter, AgentResponse, MessageEnvelope } from '../types/index.js';

/**
 * CodexAdapter — routes coding tasks to OpenAI Codex CLI.
 * Uses the OpenAI Codex CLI (codex) for code review, bug investigation, and releases.
 */
export class CodexAdapter implements AgentAdapter {
  name = 'coding-agent';
  description = 'Code review, repository tasks, bug investigation, releases, CI/CD diagnostics';

  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.CODEX_API_KEY ?? '';
  }

  async handle(req: MessageEnvelope): Promise<AgentResponse> {
    if (!this.apiKey) {
      return {
        text: '',
        error: 'CODEX_API_KEY is not set. The coding-agent is not yet configured.',
      };
    }

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are @coding-agent, an expert software engineer embedded in a RingEX team chat.
You respond with concise, actionable answers. You can read code, review PRs, explain bugs, and suggest fixes.
You may also call the 'codex' tool to run CLI commands in the repository if needed.
Format code blocks with language hints. Keep responses brief unless the user asks for detail.`,
            },
            {
              role: 'user',
              content: req.text,
            },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const err = await res.text();
        return { text: '', error: `OpenAI API error ${res.status}: ${err}` };
      }

      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content ?? 'Coding complete.';

      return { text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { text: '', error: `Codex error: ${msg}` };
    }
  }
}
