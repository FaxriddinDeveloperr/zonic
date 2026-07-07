// 1:1 chat persistence: a conversation per user pair + messages, plus attachment storage
// (mirrors the avatar/cover upload pattern). Real-time delivery + push live in ChatGateway.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createReadStream, existsSync, mkdirSync, writeFileSync, ReadStream } from 'fs';
import { basename, extname, join } from 'path';
import { randomUUID } from 'crypto';
import { formatIso } from '../common/helpers/datetime';
import { badRequest } from '../common/validation-problem';
import {
  ChatMessageDto,
  ChatMessagesResponseDto,
  ConversationDto,
  ConversationsResponseDto,
} from './dto/chat.dto';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic']);
// Voice-message audio formats (Flutter recorders usually emit .m4a/.aac/.opus).
const AUDIO_EXTS = new Set(['.m4a', '.aac', '.mp3', '.ogg', '.oga', '.opus', '.wav', '.amr', '.webm']);
const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.amr': 'audio/amr',
  '.webm': 'audio/webm',
};

/** Attachment kind from a file id's extension: image / voice / file. */
function typeOfExt(ext: string): 'image' | 'voice' | 'file' {
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (AUDIO_EXTS.has(ext)) return 'voice';
  return 'file';
}

@Injectable()
export class ChatService {
  private readonly chatDir = join(process.cwd(), 'uploads', 'chat');

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    if (!existsSync(this.chatDir)) mkdirSync(this.chatDir, { recursive: true });
  }

  /** Stable conversation id for a user pair (created on first message). */
  async getOrCreateConversation(a: string, b: string): Promise<string> {
    const [ua, ub] = a < b ? [a, b] : [b, a];
    await this.dataSource.query(
      `INSERT INTO game_chat_conversation (user_a, user_b)
       VALUES ($1, $2) ON CONFLICT (user_a, user_b) DO NOTHING`,
      [ua, ub],
    );
    const [row] = await this.dataSource.query(
      `SELECT id::text FROM game_chat_conversation WHERE user_a = $1 AND user_b = $2`,
      [ua, ub],
    );
    return row.id;
  }

  /** Persist a message. Returns the message DTO plus the recipient id for delivery. */
  async createMessage(
    senderId: string,
    peerId: string,
    text: string | null,
    attachmentFileId: string | null,
    attachmentDurationSeconds: number | null = null,
  ): Promise<{ message: ChatMessageDto; recipientId: string; senderUsername: string | null }> {
    if (senderId === peerId) throw badRequest(['You cannot message yourself.']);
    const trimmed = text?.trim() ? text.trim() : null;
    if (!trimmed && !attachmentFileId) throw badRequest(['Message must have text or an attachment.']);

    const [peer] = await this.dataSource.query(
      `SELECT id::text FROM sys_user WHERE id = $1`,
      [peerId],
    );
    if (!peer) throw new NotFoundException('Recipient not found.');

    const conversationId = await this.getOrCreateConversation(senderId, peerId);
    const attachmentType = attachmentFileId ? ChatService.attachmentTypeOf(attachmentFileId) : null;
    // Duration only meaningful for a voice attachment.
    const duration = attachmentType === 'voice' && attachmentDurationSeconds != null
      ? Math.max(0, Math.round(attachmentDurationSeconds))
      : null;
    const [sender] = await this.dataSource.query(
      `SELECT zonic_id, username FROM sys_user WHERE id = $1`,
      [senderId],
    );

    const [row] = await this.dataSource.query(
      `INSERT INTO game_chat_message
         (conversation_id, sender_id, recipient_id, text, attachment_file_id, attachment_type,
          attachment_duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id::text, sent_at`,
      [conversationId, senderId, peerId, trimmed, attachmentFileId ?? null, attachmentType, duration],
    );

    const message: ChatMessageDto = {
      id: row.id,
      conversationId,
      senderId,
      senderZonicId: sender?.zonic_id ?? null,
      text: trimmed,
      attachmentFileId: attachmentFileId ?? null,
      attachmentType,
      attachmentDurationSeconds: duration,
      sentAt: formatIso(new Date(row.sent_at)),
      isRead: false,
    };
    return { message, recipientId: peerId, senderUsername: sender?.username ?? null };
  }

  async getMessages(
    userId: string,
    peerId: string,
    page: number,
    pageSize: number,
  ): Promise<ChatMessagesResponseDto> {
    const rows: Array<{
      id: string;
      conversation_id: string;
      sender_id: string;
      sender_zonic_id: number | null;
      text: string | null;
      attachment_file_id: string | null;
      attachment_type: string | null;
      attachment_duration_seconds: number | null;
      sent_at: Date;
      is_read: boolean;
    }> = await this.dataSource.query(
      `WITH conv AS (
         SELECT CASE WHEN user_a = $1 THEN cleared_a_at ELSE cleared_b_at END AS my_cleared
           FROM game_chat_conversation
          WHERE (user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1)
       )
       SELECT m.id::text, m.conversation_id::text, m.sender_id::text,
              u.zonic_id AS sender_zonic_id, m.text, m.attachment_file_id, m.attachment_type,
              m.attachment_duration_seconds, m.sent_at, m.is_read
         FROM game_chat_message m
         JOIN sys_user u ON u.id = m.sender_id
        WHERE ((m.sender_id = $1 AND m.recipient_id = $2)
            OR (m.sender_id = $2 AND m.recipient_id = $1))
          AND ((SELECT my_cleared FROM conv) IS NULL OR m.sent_at > (SELECT my_cleared FROM conv))
        ORDER BY m.sent_at DESC
        LIMIT $3 OFFSET $4`,
      [userId, peerId, pageSize, (page - 1) * pageSize],
    );
    const items = rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      senderId: r.sender_id,
      senderZonicId: r.sender_zonic_id,
      text: r.text,
      attachmentFileId: r.attachment_file_id,
      attachmentType: r.attachment_type,
      attachmentDurationSeconds: r.attachment_duration_seconds,
      sentAt: formatIso(new Date(r.sent_at)),
      isRead: r.is_read,
    }));
    return { items, page, pageSize };
  }

  /** userIds this user has a conversation with (to notify of presence changes). */
  async getConversationPeers(userId: string): Promise<string[]> {
    const rows: Array<{ peer: string }> = await this.dataSource.query(
      `SELECT (CASE WHEN user_a = $1 THEN user_b ELSE user_a END)::text AS peer
         FROM game_chat_conversation WHERE user_a = $1 OR user_b = $1`,
      [userId],
    );
    return rows.map((r) => r.peer);
  }

  async touchLastSeen(userId: string): Promise<Date> {
    const [row] = await this.dataSource.query(
      `UPDATE sys_user SET last_seen_at = now() WHERE id = $1 RETURNING last_seen_at`,
      [userId],
    );
    // UPDATE ... RETURNING comes back as [rows, count] in some drivers; re-read defensively.
    if (row?.last_seen_at) return new Date(row.last_seen_at);
    const [r2] = await this.dataSource.query(`SELECT last_seen_at FROM sys_user WHERE id = $1`, [userId]);
    return r2?.last_seen_at ? new Date(r2.last_seen_at) : new Date();
  }

  async getLastSeen(userId: string): Promise<string | null> {
    const [row] = await this.dataSource.query(
      `SELECT last_seen_at FROM sys_user WHERE id = $1`,
      [userId],
    );
    return row?.last_seen_at ? formatIso(new Date(row.last_seen_at)) : null;
  }

  async getConversations(
    userId: string,
    page: number,
    pageSize: number,
    isOnline: (id: string) => boolean = () => false,
  ): Promise<ConversationsResponseDto> {
    // For each conversation the user is part of: the peer, the latest message, and unread count.
    const rows: Array<{
      conversation_id: string;
      peer_id: string;
      peer_zonic_id: number | null;
      peer_username: string | null;
      peer_avatar_file_id: string | null;
      peer_last_seen: Date | null;
      last_text: string | null;
      last_attachment_type: string | null;
      last_at: Date | null;
      unread: string;
    }> = await this.dataSource.query(
      `SELECT c.id::text AS conversation_id,
              p.id::text AS peer_id, p.zonic_id AS peer_zonic_id, p.username AS peer_username,
              p.avatar_file_id AS peer_avatar_file_id, p.last_seen_at AS peer_last_seen,
              lm.text AS last_text, lm.attachment_type AS last_attachment_type, lm.sent_at AS last_at,
              (SELECT COUNT(*) FROM game_chat_message um
                 WHERE um.conversation_id = c.id AND um.recipient_id = $1 AND um.is_read = false
                   AND (mc.my_cleared IS NULL OR um.sent_at > mc.my_cleared)) AS unread
         FROM game_chat_conversation c
         JOIN sys_user p ON p.id = CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END
         CROSS JOIN LATERAL (
           SELECT CASE WHEN c.user_a = $1 THEN c.cleared_a_at ELSE c.cleared_b_at END AS my_cleared
         ) mc
         LEFT JOIN LATERAL (
           SELECT text, attachment_type, sent_at FROM game_chat_message m
            WHERE m.conversation_id = c.id
              AND (mc.my_cleared IS NULL OR m.sent_at > mc.my_cleared)
            ORDER BY m.sent_at DESC LIMIT 1
         ) lm ON true
        WHERE (c.user_a = $1 OR c.user_b = $1) AND lm.sent_at IS NOT NULL
        ORDER BY lm.sent_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, pageSize, (page - 1) * pageSize],
    );
    const items: ConversationDto[] = rows.map((r) => ({
      conversationId: r.conversation_id,
      peerId: r.peer_id,
      peerZonicId: r.peer_zonic_id,
      peerUsername: r.peer_username,
      peerAvatarFileId: r.peer_avatar_file_id,
      peerOnline: isOnline(r.peer_id),
      peerLastSeenAt: r.peer_last_seen ? formatIso(new Date(r.peer_last_seen)) : null,
      lastMessageText: r.last_text,
      lastAttachmentType: r.last_attachment_type,
      lastMessageAt: r.last_at ? formatIso(new Date(r.last_at)) : null,
      unreadCount: Number(r.unread),
    }));
    return { items, page, pageSize };
  }

  /** Delete a conversation for the caller only (peer keeps their copy) — sets their cleared_at. */
  async deleteConversation(userId: string, peerId: string): Promise<void> {
    const [ua, ub] = userId < peerId ? [userId, peerId] : [peerId, userId];
    const col = userId === ua ? 'cleared_a_at' : 'cleared_b_at';
    await this.dataSource.query(
      `UPDATE game_chat_conversation SET ${col} = now() WHERE user_a = $1 AND user_b = $2`,
      [ua, ub],
    );
  }

  /** Delete a single message (own message only) for both sides. Returns delivery info for the event. */
  async deleteMessage(
    userId: string,
    messageId: string,
  ): Promise<{ recipientId: string; conversationId: string }> {
    const [row] = await this.dataSource.query(
      `SELECT sender_id::text, recipient_id::text, conversation_id::text
         FROM game_chat_message WHERE id = $1`,
      [messageId],
    );
    if (!row) throw new NotFoundException('Message not found.');
    if (row.sender_id !== userId) throw badRequest(['You can only delete your own message.']);
    await this.dataSource.query(`DELETE FROM game_chat_message WHERE id = $1`, [messageId]);
    return { recipientId: row.recipient_id, conversationId: row.conversation_id };
  }

  /** Mark all messages from peer → user as read. Returns the affected message ids. */
  async markRead(userId: string, peerId: string): Promise<string[]> {
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `UPDATE game_chat_message SET is_read = true
        WHERE recipient_id = $1 AND sender_id = $2 AND is_read = false
        RETURNING id::text`,
      [userId, peerId],
    );
    return rows.map((r) => r.id);
  }

  // ── Attachments (reuse the avatar/cover on-disk pattern) ────────────────────
  saveAttachment(file: UploadedFile | undefined): { fileId: string; attachmentType: string } {
    if (!file || !file.buffer?.length) {
      throw badRequest(['No file uploaded (expected form field "file").']);
    }
    let ext = extname(file.originalname || '').toLowerCase();
    if (!ext && file.mimetype?.startsWith('image/')) {
      ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    }
    if (!ext && file.mimetype?.startsWith('audio/')) {
      ext = file.mimetype.includes('mpeg') ? '.mp3' : file.mimetype.includes('aac') ? '.aac' : '.m4a';
    }
    if (!/^\.[a-z0-9]{1,8}$/.test(ext)) ext = '.bin';
    const attachmentType = typeOfExt(ext);
    const fileId = `${randomUUID()}${ext}`;
    writeFileSync(join(this.chatDir, fileId), file.buffer);
    return { fileId, attachmentType };
  }

  openAttachment(fileId: string | undefined): { stream: ReadStream; contentType: string } {
    if (!fileId) throw badRequest(['fileId is required.']);
    const safe = basename(fileId);
    if (safe !== fileId || !/^[\w.-]+$/.test(safe)) throw badRequest(['Invalid fileId.']);
    const full = join(this.chatDir, safe);
    if (!existsSync(full)) throw new NotFoundException('Attachment not found.');
    const ext = extname(safe).toLowerCase();
    return { stream: createReadStream(full), contentType: EXT_TO_MIME[ext] ?? 'application/octet-stream' };
  }

  static attachmentTypeOf(fileId: string): string {
    return typeOfExt(extname(fileId).toLowerCase());
  }
}
