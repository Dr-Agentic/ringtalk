/**
 * RingTalk Emulator — local web UI for testing the bot without RingCentral.
 *
 * Starts an Express server on port 3001.
 * GET  /           → redirect to /emulator
 * GET  /emulator   → self-contained HTML chat UI
 * POST /api/chat   → { text, agentName } → routes through the Router → returns response
 *
 * Usage:
 *   npm run emulator
 *
 * Environment:
 *   EMULATOR_PORT=3001   (default: 3001)
 *   OPENROUTER_API_KEY=sk-or-...  (required for @llm-agent; optional for @echo-agent)
 */

import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import { AgentRegistry } from '../gateway/registry.js';

// ── Emulator chat message shape ────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  agent?: string;
  text: string;
  timestamp: string;
  error?: boolean;
}

interface ChatRequest {
  text: string;
  agentName: string;
}

// ── HTML UI ──────────────────────────────────────────────────────────────────

const UI = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RingTalk Emulator</title>
  <style>
    :root { --bg:#0f172a; --surface:#1e293b; --border:#334155; --accent:#38bdf8; --text:#e2e8f0; --muted:#94a3b8; --error:#f87171; --agent:#a78bfa; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:var(--bg); color:var(--text); font-family:ui-sans-serif,system-ui,sans-serif; height:100vh; display:flex; flex-direction:column; }
    header { padding:16px 24px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:16px; flex-shrink:0; }
    header h1 { font-size:18px; font-weight:700; color:var(--accent); }
    header span { font-size:12px; color:var(--muted); }
    .agent-select { margin-left:auto; display:flex; gap:8px; align-items:center; }
    .agent-select label { font-size:13px; color:var(--muted); }
    .agent-select select { background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:8px; padding:6px 12px; font-size:13px; cursor:pointer; }
    #chat { flex:1; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:16px; }
    .msg { display:flex; gap:10px; max-width:720px; }
    .msg.user { align-self:flex-end; flex-direction:row-reverse; }
    .msg .avatar { width:32px; height:32px; border-radius:10px; display:grid; place-items:center; font-size:12px; font-weight:800; flex-shrink:0; }
    .msg.user .avatar { background:#38bdf8; color:#0f172a; }
    .msg.agent .avatar { background:var(--agent); color:#0f172a; }
    .bubble { padding:10px 14px; border-radius:14px; max-width:480px; line-height:1.5; font-size:14px; }
    .msg.user .bubble { background:#38bdf8; color:#0f172a; border-bottom-right-radius:4px; }
    .msg.agent .bubble { background:var(--surface); border:1px solid var(--border); border-bottom-left-radius:4px; }
    .bubble.error { border-color:var(--error); color:var(--error); }
    .bubble .meta { font-size:11px; color:var(--muted); margin-top:4px; }
    .typing { display:flex; gap:10px; max-width:720px; align-self:flex-end; }
    .typing .avatar { width:32px; height:32px; border-radius:10px; display:grid; place-items:center; background:var(--agent); color:#0f172a; font-size:12px; font-weight:800; flex-shrink:0; }
    .typing .dots { display:flex; gap:4px; align-items:center; padding:10px 14px; background:var(--surface); border:1px solid var(--border); border-radius:14px; border-bottom-left-radius:4px; }
    .dot { width:6px; height:6px; border-radius:50%; background:var(--muted); animation:bounce 1.4s infinite; }
    .dot:nth-child(2) { animation-delay:.2s; } .dot:nth-child(3) { animation-delay:.4s; }
    @keyframes bounce { 0%,80%,100%{transform:scale(1)} 40%{transform:scale(1.3)} }
    footer { padding:16px 24px; border-top:1px solid var(--border); display:flex; gap:10px; flex-shrink:0; }
    footer input { flex:1; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:12px; padding:10px 16px; font-size:14px; outline:none; }
    footer input:focus { border-color:var(--accent); }
    footer button { background:var(--accent); color:#0f172a; border:none; border-radius:12px; padding:10px 20px; font-size:14px; font-weight:700; cursor:pointer; }
    footer button:disabled { opacity:.5; cursor:not-allowed; }
    .info { padding:16px 24px; font-size:12px; color:var(--muted); border-top:1px solid var(--border); flex-shrink:0; }
    .info code { background:var(--surface); padding:2px 6px; border-radius:4px; color:var(--accent); }
  </style>
</head>
<body>
  <header>
    <h1>RingTalk Emulator</h1>
    <span>Local bot testing — no RingCentral required</span>
    <div class="agent-select">
      <label for="agent">Agent:</label>
      <select id="agent">
        <option value="echo-agent">@echo-agent (dev, no key)</option>
        <option value="llm-agent">@llm-agent (OpenRouter)</option>
        <option value="ops-agent">@ops-agent (no key)</option>
      </select>
    </div>
  </header>
  <div id="chat"></div>
  <footer>
    <input id="input" placeholder="Type a message… (mention an agent: @echo-agent, @llm-agent, @ops-agent)" autofocus />
    <button id="send">Send</button>
  </footer>
  <div class="info">
    <b>Tip:</b> Mention an agent in your message, e.g. <code>@llm-agent summarize this</code>.
    The emulator routes through the same Router as the real RingEX webhook.
  </div>

  <script>
    const chat = document.getElementById('chat');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const agentSel = document.getElementById('agent');

    function scroll() { chat.scrollTop = chat.scrollHeight; }

    function addMsg(role, text, opts = {}) {
      const div = document.createElement('div');
      div.className = 'msg ' + role;
      const initials = role === 'user' ? 'U' : (opts.agent || 'A')[0].toUpperCase();
      div.innerHTML = '<div class="avatar">' + initials + '</div>' +
        '<div class="bubble' + (opts.error ? ' error' : '') + '">' +
        String(text).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>') +
        (opts.agent ? '<div class="meta">' + opts.agent + '</div>' : '') +
        '</div>';
      chat.appendChild(div);
      scroll();
    }

    function showTyping(agent) {
      const div = document.createElement('div');
      div.className = 'typing';
      div.id = 'typing';
      div.innerHTML = '<div class="avatar">' + (agent || 'A')[0].toUpperCase() + '</div>' +
        '<div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
      chat.appendChild(div);
      scroll();
    }

    function removeTyping() {
      document.getElementById('typing')?.remove();
    }

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

    async function send() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      addMsg('user', text);
      const agentName = agentSel.value;
      showTyping(agentName);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, agentName }),
        });
        removeTyping();
        const data = await res.json();
        if (data.error) {
          addMsg('agent', data.error, { agent: agentName, error: true });
        } else if (data.messages) {
          for (const msg of data.messages) {
            if (msg.role === 'agent') {
              addMsg('agent', msg.text, { agent: msg.agent });
            }
          }
        }
      } catch (err) {
        removeTyping();
        addMsg('agent', 'Network error: ' + err.message, { agent: agentName, error: true });
      }
    }
  </script>
</body>
</html>`;

// ── Emulator Server ──────────────────────────────────────────────────────────

export interface EmulatorDeps {
  /** Agent registry — used to look up the requested adapter */
  registry: AgentRegistry;
}

/**
 * Build and return a ready-to-use HTTP server.
 * Call server.listen(PORT) to start.
 *
 * Routes:
 *   GET  /           → /emulator
 *   GET  /emulator   → HTML chat UI
 *   POST /api/chat   → { text, agentName } → ChatMessage[]
 */
export function buildEmulator({ registry }: EmulatorDeps) {
  const app = express();
  app.use(express.json());

  // ── UI ────────────────────────────────────────────────────────────────────

  app.get('/', (_req: Request, res: Response) => res.redirect('/emulator'));
  app.get('/emulator', (_req: Request, res: Response) => res.type('html').send(UI));

  // ── Chat API ──────────────────────────────────────────────────────────────

  app.post('/api/chat', async (req: Request, res: Response) => {
    const body = req.body as Partial<ChatRequest>;
    const { text, agentName } = body;

    if (!text?.trim()) {
      res.status(400).json({ error: 'text is required' });
      return;
    }
    if (!agentName?.trim()) {
      res.status(400).json({ error: 'agentName is required' });
      return;
    }

    // Build a synthetic envelope — mirrors what RingEX webhook would deliver
    const chatId = `emulator-${Date.now()}`;
    const envelope = {
      chatId,
      threadId: chatId,
      senderId: 'emulator-user',
      senderName: 'Emulator User',
      mentionedAgents: [agentName.replace('@', '')],
      text,
      rawEvent: Object.freeze({
        type: 'Message4Bot' as const,
        chatId,
        chatType: 'Direct' as const,
        from: { id: 'emulator-user', name: 'Emulator User' },
        text,
        mentions: [agentName],
        creatorId: 'emulator-user',
        creationTime: new Date().toISOString(),
      }),
      sessionId: `${chatId}:${agentName}`,
      timestamp: new Date().toISOString(),
    };

    try {
      const adapter = registry.get(agentName);
      if (!adapter) {
        const msgs: ChatMessage[] = [{
          id: Math.random().toString(36).slice(2),
          role: 'agent',
          agent: agentName,
          text: `No agent registered: @${agentName}. Try: @echo-agent, @llm-agent, or @ops-agent.`,
          timestamp: new Date().toISOString(),
        }];
        res.json({ messages: msgs });
        return;
      }

      const response = await adapter.handle(envelope);
      const msgs: ChatMessage[] = [{
        id: Math.random().toString(36).slice(2),
        role: 'agent',
        agent: response.agent ?? agentName,
        text: response.error ?? response.text,
        timestamp: new Date().toISOString(),
        error: !!response.error,
      }];
      res.json({ messages: msgs });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const msgs: ChatMessage[] = [{
        id: Math.random().toString(36).slice(2),
        role: 'agent',
        agent: agentName,
        text: `Internal error: ${msg}`,
        timestamp: new Date().toISOString(),
        error: true,
      }];
      res.json({ messages: msgs });
    }
  });

  return createServer(app);
}
