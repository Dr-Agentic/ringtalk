/**
 * RingTalk Emulator — CLI entry point.
 *
 * Sets up dependencies (registry) and starts the emulator HTTP server on port 3001.
 *
 * Usage:
 *   npm run emulator
 *
 * With OpenRouter (for @llm-agent):
 *   OPENROUTER_API_KEY=sk-or-... npm run emulator
 *
 * Environment:
 *   EMULATOR_PORT=3001  (default: 3001)
 *   LOG_LEVEL=debug     (default: info)
 */

import 'dotenv/config';
import { buildRegistry } from '../gateway/registry.js';
import { buildEmulator } from './server.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
  const port = parseInt(process.env.EMULATOR_PORT ?? '3001', 10);

  console.log('🚀 RingTalk Emulator starting…');
  console.log(`   Port : ${port}`);
  console.log(`   LLM  : ${process.env.OPENROUTER_API_KEY ? 'enabled (@llm-agent)' : 'disabled (set OPENROUTER_API_KEY)'}`);
  console.log('');

  // Build agent registry (same logic as the real server)
  const registry = await buildRegistry();

  // Build and start the HTTP server
  const server = buildEmulator({ registry });

  server.listen(port, () => {
    console.log(`✅ RingTalk Emulator ready`);
    console.log(`   UI  : http://localhost:${port}/emulator`);
    console.log(`   API : http://localhost:${port}/api/chat`);
    console.log('');
    console.log(`   Registered agents:`);
    for (const agent of registry.list()) {
      console.log(`     @${agent.name} — ${agent.description}`);
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n👋 Shutting down…');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('❌ Emulator failed to start:', err);
  process.exit(1);
});
