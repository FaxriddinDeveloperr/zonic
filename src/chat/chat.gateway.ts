// Real-time 1:1 chat over Socket.IO namespace /hubs/chat. Same JWT handshake as /hubs/location,
// but a separate connection so chat stays live independent of run sessions.
//   Client → Server:  SendMessage { peerId, text?, attachmentFileId?, clientTempId }
//                     MarkRead    { peerId }
//   Server → Client:  MessageReceived <ChatMessage>(+clientTempId if it's the sender's own)
//                     MessageRead     { peerId, messageIds }
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatMessageDto } from './dto/chat.dto';

@WebSocketGateway({ namespace: '/hubs/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Namespace;
  private readonly logger = new Logger(ChatGateway.name);

  // userId → set of connected socket ids (presence).
  private readonly online = new Map<string, Set<string>>();

  constructor(
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket): void {
    const userId = this.authenticate(client);
    if (!userId) {
      client.disconnect(true);
      return;
    }
    client.data.userId = userId;
    void client.join(userId); // a room per user → emit to all of a user's devices
    const set = this.online.get(userId) ?? new Set<string>();
    set.add(client.id);
    this.online.set(userId, set);
    client.emit('Connected', client.id);

    client.on('SendMessage', (payload: unknown) => void this.onSend(client, payload));
    client.on('MarkRead', (payload: unknown) => void this.onMarkRead(client, payload));
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    const set = this.online.get(userId);
    set?.delete(client.id);
    if (set && set.size === 0) this.online.delete(userId);
  }

  private isOnline(userId: string): boolean {
    return (this.online.get(userId)?.size ?? 0) > 0;
  }

  private async onSend(client: Socket, payload: unknown): Promise<void> {
    const userId = client.data.userId as string;
    const p = (payload ?? {}) as {
      peerId?: string;
      text?: string;
      attachmentFileId?: string;
      clientTempId?: string;
    };
    if (!p.peerId) return;
    try {
      const { message, recipientId, senderUsername } = await this.chat.createMessage(
        userId,
        p.peerId,
        p.text ?? null,
        p.attachmentFileId ?? null,
      );
      await this.deliver(message, recipientId, userId, senderUsername, {
        echoToSender: true,
        clientTempId: p.clientTempId,
      });
    } catch (e) {
      client.emit('SendError', { clientTempId: p.clientTempId, message: (e as Error).message });
    }
  }

  private async onMarkRead(client: Socket, payload: unknown): Promise<void> {
    const userId = client.data.userId as string;
    const p = (payload ?? {}) as { peerId?: string };
    if (!p.peerId) return;
    const messageIds = await this.chat.markRead(userId, p.peerId);
    this.emitRead(userId, p.peerId, messageIds);
  }

  /** Tell the original sender (peer) that `readerId` has read the given messages. */
  emitRead(readerId: string, peerId: string, messageIds: string[]): void {
    if (messageIds.length && this.isOnline(peerId)) {
      this.server.to(peerId).emit('MessageRead', { peerId: readerId, messageIds });
    }
  }

  /**
   * Deliver a message: to the recipient live if connected, otherwise a chat_message push. Echo to
   * the sender's other devices (with clientTempId) so an optimistic UI reconciles. Called by both
   * the socket handler and the REST fallback (ChatController).
   */
  async deliver(
    message: ChatMessageDto,
    recipientId: string,
    senderId: string,
    senderUsername: string | null,
    opts: { echoToSender: boolean; clientTempId?: string },
  ): Promise<void> {
    if (this.isOnline(recipientId)) {
      this.server.to(recipientId).emit('MessageReceived', message);
    } else {
      const preview =
        message.text ?? (message.attachmentType === 'image' ? '📷 Rasm' : '📎 Fayl');
      await this.notifications.create(
        recipientId,
        'chat_message',
        senderUsername ?? 'Yangi xabar',
        preview,
        {
          fromZonicId: message.senderZonicId,
          fromUsername: senderUsername,
          conversationId: message.conversationId,
          preview,
        },
      );
    }
    if (opts.echoToSender) {
      const echo = opts.clientTempId ? { ...message, clientTempId: opts.clientTempId } : message;
      this.server.to(senderId).emit('MessageReceived', echo);
    }
  }

  private authenticate(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, string | undefined>;
    const query = client.handshake.query as Record<string, string | string[] | undefined>;
    const token = auth?.access_token || auth?.token || (query?.access_token as string | undefined);
    if (!token) return null;
    try {
      const payload = this.jwt.verify<{ sub: string }>(token, {
        secret: this.config.get<string>('jwt.secretKey'),
        issuer: this.config.get<string>('jwt.issuer'),
        audience: this.config.get<string>('jwt.audience'),
        algorithms: ['HS256'],
      });
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }
}
