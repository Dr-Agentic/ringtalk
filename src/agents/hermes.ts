import type { AgentAdapter, AgentResponse, MessageEnvelope } from '../types/index.js';

/**
 * HermesAdapter — routes research tasks to the Hermes agent gateway.
 * Speaks to Hermes via HTTP POST to the configured HERMES_URL.
 */
export class HermesAdapter implements AgentAdapter {
  name = 'research-agent';
  description = 'Research, synthesis, competitive analysis, briefs, web search';

  private readonly url: string;
  private readonly apiKey: string;

  constructor() {
    this.url   = process.env.HERMES_URL   ?? 'http://localhost:2222';
    this.apiKey = process.env.HERMES_API_KEY ?? '';
  }

  async handle(req: MessageEnvelope): Promise<AgentResponse> {
    try {
      const body = JSON.stringify({
        task: req.text,
        session: req.sessionId,
        sender: req.senderName,
        mode: 'research',
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(this.url + '/v1/research', {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const err = await res.text();
        return { text: '', error: `Hermes returned ${res.status}: ${err}` };
      }

      const data = await res.json() as Record<string, unknown>;

      return {
        text: String(data.text ?? data.result ?? 'Research complete.'),
        citations: (data.citations as AgentResponse['citations']) ?? [],
        status: typeof data.status === 'string' ? data.status : undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        text: '',
        error: `Failed to reach Hermes at ${this.url}: ${msg}. Is Hermes running?`,
      };
    }
  }
}
