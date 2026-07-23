import type { AgentAdapter } from '../types/index.js';

/**
 * AgentRegistry maps agent names to their adapter instances.
 * Adapters are registered once at startup; the registry is consulted
 * on every incoming message to find the right handler.
 */
export class AgentRegistry {
  private agents = new Map<string, AgentAdapter>();

  register(adapter: AgentAdapter): void {
    if (this.agents.has(adapter.name)) {
      console.warn(`[AgentRegistry] Overwriting existing agent: ${adapter.name}`);
    }
    this.agents.set(adapter.name, adapter);
    console.log(`[AgentRegistry] Registered agent: @${adapter.name}`);
  }

  get(name: string): AgentAdapter | undefined {
    return this.agents.get(name.replace('@', ''));
  }

  list(): AgentAdapter[] {
    return [...this.agents.values()];
  }

  has(name: string): boolean {
    return this.agents.has(name.replace('@', ''));
  }
}

/**
 * Build a default registry with built-in adapters.
 * Lazy-import adapters to avoid loading unused ones.
 */
export async function buildRegistry(): Promise<AgentRegistry> {
  const registry = new AgentRegistry();

  // Always available — no API key needed
  const { EchoAdapter } = await import('../agents/echo.js');
  registry.register(new EchoAdapter());

  // Research agent — wires to Hermes
  if (process.env.HERMES_URL || process.env.HERMES_API_KEY) {
    try {
      const { HermesAdapter } = await import('../agents/hermes.js');
      registry.register(new HermesAdapter());
    } catch (err) {
      console.warn('[AgentRegistry] Failed to load HermesAdapter:', err);
    }
  }

  // Coding agent — wires to OpenAI Codex CLI
  if (process.env.CODEX_API_KEY) {
    try {
      const { CodexAdapter } = await import('../agents/codex.js');
      registry.register(new CodexAdapter());
    } catch (err) {
      console.warn('[AgentRegistry] Failed to load CodexAdapter:', err);
    }
  }

  // Ops agent — internal tools + Hermes
  try {
    const { OpsAdapter } = await import('../agents/ops.js');
    registry.register(new OpsAdapter());
  } catch (err) {
    console.warn('[AgentRegistry] Failed to load OpsAdapter:', err);
  }

  return registry;
}
