import { SDK } from '@ringcentral/sdk';
import type { AgentResponse, Media } from '../types/index.js';

// ── RingEX Markdown → RingEX-supported markdown ─────────────────────────────────
// RingEX supports a subset of markdown: bold, italic, code, links, lists

export function toRingEXMarkdown(text: string): string {
  return text
    // Bold: **text** → <b>text</b>  (RingEX native)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    // Italic: *text* or _text_ → <i>text</i>
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<i>$1</i>')
    // Inline code: `code` → <code>code</code>
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    // Code blocks: ```code``` → <code>...</code>
    .replace(/```([\s\S]+?)```/g, '<code>$1</code>')
    // Links: [text](url) → keep as markdown link (RingEX renders these)
    // Preserve newlines as <br> for readability
    .replace(/\n/g, '<br>');
}

// ── Sender ─────────────────────────────────────────────────────────────────────

export class RingEXSender {
  constructor(private readonly sdk: SDK) {}

  /**
   * Send a plain text / markdown message to a RingEX chat.
   */
  async sendMessage(chatId: string, text: string): Promise<string | null> {
    try {
      const r = await this.sdk.post('/restapi/v1.0/glip/chats/' + chatId + '/posts', {
        text: toRingEXMarkdown(text),
      });
      return r.data?.id ?? null;
    } catch (err) {
      console.error('[RingEX] sendMessage failed:', err);
      return null;
    }
  }

  /**
   * Send a "typing" indicator to a chat — RingEX shows the bot as typing.
   */
  async sendTyping(chatId: string): Promise<void> {
    try {
      await this.sdk.post('/restapi/v1.0/glip/chats/' + chatId + '/typing', {});
    } catch {
      // Non-critical — swallow errors
    }
  }

  /**
   * Send a structured card (Adaptive Card / structured content).
   */
  async sendCard(chatId: string, card: Record<string, unknown>): Promise<string | null> {
    try {
      const r = await this.sdk.post('/restapi/v1.0/glip/chats/' + chatId + '/posts', {
        attachments: [card],
      });
      return r.data?.id ?? null;
    } catch (err) {
      console.error('[RingEX] sendCard failed:', err);
      return null;
    }
  }

  /**
   * Send a progress / status message — used while agent is working.
   * Returns the postId so it can be edited later.
   */
  async sendStatusMessage(chatId: string, status: string): Promise<string | null> {
    return this.sendMessage(chatId, `*${status}*`);
  }

  /**
   * Edit an existing post — used to update a status message in place.
   */
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

  /**
   * Send a message with a file attachment.
   */
  async sendFileMessage(chatId: string, text: string, media: Media): Promise<string | null> {
    try {
      // For images: POST to /glip/chats/{chatId}/posts with inline content
      if (media.type === 'image' && media.content) {
        const r = await this.sdk.post('/restapi/v1.0/glip/chats/' + chatId + '/posts', {
          text: toRingEXMarkdown(text),
          attachments: [
            {
              type: 'Image',
              content: media.content,
              filename: media.name,
            },
          ],
        });
        return r.data?.id ?? null;
      }
      // For files: use the file upload endpoint
      return this.sendMessage(chatId, text + '\n\n[Attachment: ' + media.name + ']');
    } catch (err) {
      console.error('[RingEX] sendFileMessage failed:', err);
      return this.sendMessage(chatId, text);
    }
  }

  /**
   * Map an AgentResponse to one or more RingEX messages.
   * Handles: status messages, text, citations, file attachments.
   */
  async sendResponse(chatId: string, res: AgentResponse): Promise<void> {
    // 1. Status message first (shows the agent is working)
    if (res.status) {
      await this.sendStatusMessage(chatId, res.status);
    }

    // 2. Main text response
    if (res.text) {
      let body = res.text;

      // Append citations
      if (res.citations?.length) {
        body += '\n\n**Sources:**\n' + res.citations
          .map((c) => `• [${c.title}](${c.url})`)
          .join('\n');
      }

      await this.sendMessage(chatId, body);
    }

    // 3. File attachments
    if (res.files?.length) {
      for (const file of res.files) {
        await this.sendFileMessage(chatId, '', file);
      }
    }

    // 4. Error
    if (res.error) {
      await this.sendMessage(chatId, `⚠️ Error: ${res.error}`);
    }
  }
}
