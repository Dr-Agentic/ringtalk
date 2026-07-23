import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from './registry.js';
import type { AgentAdapter, AgentResponse, MessageEnvelope } from '../types/index.js';

// Minimal test adapter
const mockAdapter = (name: string): AgentAdapter => ({
  name,
  description: `Test adapter: ${name}`,
  handle: async (_req: MessageEnvelope): Promise<AgentResponse> => ({
    text: `Response from ${name}`,
  }),
});

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it('registers and retrieves an agent by name', () => {
    registry.register(mockAdapter('research-agent'));
    expect(registry.has('research-agent')).toBe(true);
    expect(registry.has('unknown-agent')).toBe(false);
  });

  it('retrieves the correct adapter', () => {
    registry.register(mockAdapter('coding-agent'));
    const adapter = registry.get('coding-agent');
    expect(adapter?.name).toBe('coding-agent');
  });

  it('strips @ prefix from agent names', () => {
    registry.register(mockAdapter('research-agent'));
    expect(registry.has('@research-agent')).toBe(true);
    expect(registry.get('@research-agent')?.name).toBe('research-agent');
  });

  it('lists all registered agents', () => {
    registry.register(mockAdapter('research-agent'));
    registry.register(mockAdapter('coding-agent'));
    const agents = registry.list();
    expect(agents).toHaveLength(2);
    expect(agents.map(a => a.name)).toContain('research-agent');
    expect(agents.map(a => a.name)).toContain('coding-agent');
  });

  it('overwrites existing agent with same name', () => {
    registry.register(mockAdapter('ops-agent'));
    registry.register(mockAdapter('ops-agent'));
    expect(registry.list()).toHaveLength(1);
  });
});
