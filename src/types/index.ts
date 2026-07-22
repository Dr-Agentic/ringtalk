// ── RingEX event shapes ──────────────────────────────────────────────────────

export interface RingEXUser {
  id: string;
  name: string;
  email?: string;
}

export interface RingEXMessageEvent {
  type: 'Message4Bot';
  chatId: string;
  chatType: 'Direct' | 'Group';
  from: RingEXUser;
  text: string;
  mentions: string[];          // e.g. ['@research-agent']
  groupId?: string;
  creatorId: string;
  creationTime: string;
  attachments?: RingEXAttachment[];
}

export interface RingEXGroupUpdatedEvent {
  type: 'GroupUpdated';
  groupId: string;
  chatType: 'Direct' | 'Group';
  membersAdded?: string[];
  membersRemoved?: string[];
  timestamp: string;
}

export type RingEXEvent = RingEXMessageEvent | RingEXGroupUpdatedEvent;

export interface RingEXAttachment {
  id: string;
  type: 'File' | 'Image' | 'Card';
  name?: string;
  uri?: string;
}

// ── Core gateway types ─────────────────────────────────────────────────────────

export interface MessageEnvelope {
  chatId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  mentionedAgents: string[];   // e.g. ['research-agent'] (without @)
  text: string;                 // message content stripped of @mentions
  rawEvent: RingEXEvent;
  sessionId: string;             // `${chatId}:${agentName}`
  timestamp: string;
}

export interface Citation {
  title: string;
  url: string;
  snippet?: string;
}

export interface AgentAction {
  type: 'send_message' | 'create_reminder' | 'update_crm' | 'book_meeting' | 'http_request';
  params: Record<string, unknown>;
}

export interface AgentResponse {
  text: string;
  files?: Media[];
  status?: string;               // e.g. 'Researching 14 sources…'
  citations?: Citation[];
  actions?: AgentAction[];
  streaming?: boolean;
  error?: string;
}

export interface Media {
  id?: string;
  type: 'file' | 'image';
  name: string;
  url?: string;                 // public URL
  content?: string;             // base64 content
  mimeType: string;
}

// ── Agent adapter interface ───────────────────────────────────────────────────

export interface AgentAdapter {
  name: string;                 // 'research-agent' (no @)
  description: string;
  handle(req: MessageEnvelope): Promise<AgentResponse>;
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  chatId: string;
  agentName: string;
  createdAt: Date;
  lastActiveAt: Date;
  context: SessionContext;
}

export interface SessionContext {
  // Key: message id / timestamp
  // Value: { role: 'user' | 'agent', content: string }
  history: Array<{
    messageId: string;
    role: 'user' | 'agent';
    content: string;
    timestamp: Date;
  }>;
}
