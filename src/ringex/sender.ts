import { SDK } from '@ringcentral/sdk';
import type { AgentResponse, Media } from '../types/index.js';

// ── RingEX Markdown ─────────────────────────────────────────────────────────────

export function toRingEXMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<i>$1</i>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/```([\s\S]+?)```/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// ── Sender ─────────────────────────────────────────────────────────────────────

export class RingEXSender {
  constructor(private readonly sdk: SDK) {}

  private async api<T>(path: string, body?: unknown): Promise<T> {
    const res = await this.sdk.post(path, body);
    return res.json() as Promise<T>;
  }

  async sendMessage(chatId: string, text: string): Promise<string | null> {
    try {
      const res = await this.api<{ id?: string }>('/restapi/v1.0/glip/chats/' + chatId + '/posts', {
        text: toRingEXMarkdown(text),
      });
      return res.id ?? null;
    } catch (err) {
      console.error('[RingEX] sendMessage failed:', err);
      return null;
    }
  }

  async sendTyping(chatId: string): Promise<void> {
    try {
      await this.sdk.post('/restapi/v1.0/glip/chats/' + chatId + '/typing', {});
    } catch {
      // Non-critical
    }
  }

  async sendCard(chatId: string, card: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await this.api<{ id?: string }>('/restapi/v1.0/glip/chats/' + chatId + '/posts', {
        attachments: [card],
      });
      return res.id ?? null;
    } catch (err) {
      console.error('[RingEX] sendCard failed:', err);
      return null;
    }
  }

  async sendStatusMessage(chatId: string, status: string): Promise<string | null> {
    return this.sendMessage(chatId, `*${status}*`);
  }

  async editPost(postId: string, chatId: string, text: string): Promise<boolean> {
    try {
      await this.sdk.put('/restapi/v1.0/glip/chats/' + chatId + '/posts/' + postId, {
        text: toRingEXMarkdown(text),
      });
      return true;
    } catch (err) {
      console.error('[RingEX] editPost failed:', err);
      return false;
    }
  }

  async sendFileMessage(chatId: string, text: string, media: Media): Promise<string | null> {
    if (media.type === 'image' && media.content) {
      try {
        const res = await this.api<{ id?: string }>('/restapi/v1.0/glip/chats/' + chatId + '/posts', {
          text: toRingEXMarkdown(text),
          attachments: [{ type: 'Image', content: media.content, filename: media.name }],
        });
        return res.id ?? null;
      } catch {
        return this.sendMessage(chatId, text + '\n\n[Attachment: ' + media.name + ']');
      }
    }
    return this.sendMessage(chatId, text + '\n\n[Attachment: ' + media.name + ']');
  }

  async sendResponse(chatId: string, res: AgentResponse): Promise<void> {
    if (res.status) {
      await this.sendStatusMessage(chatId, res.status);
    }

    if (res.text) {
      let body = res.text;
      if (res.citations?.length) {
        body += '\n\n**Sources:**\n' + res.citations
          .map((c) => `• [${c.title}](${c.url})`)
          .join('\n');
      }
      await this.sendMessage(chatId, body);
    }

    if (res.files?.length) {
      for (const file of res.files) {
        await this.sendFileMessage(chatId, '', file);
      }
    }

    if (res.error) {
      await this.sendMessage(chatId, `⚠️ Error: ${res.error}`);
    }
  }
}
