import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ format: 'uuid', description: "Peer's userId (uuid)" })
  @IsString()
  peerId: string;

  @ApiPropertyOptional({ description: 'Message text (may be null if only an attachment)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @ApiPropertyOptional({ description: 'Attachment file id from /Chat/UploadAttachment' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  attachmentFileId?: string;
}

export class MarkChatReadDto {
  @ApiProperty({ format: 'uuid', description: "Peer's userId (uuid) — mark their messages read" })
  @IsString()
  peerId: string;
}

export class ChatPageQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  Page = 1;

  @ApiPropertyOptional({ type: Number, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  PageSize = 30;
}

export class ChatMessagesQueryDto extends ChatPageQueryDto {
  @ApiProperty({ format: 'uuid', description: "Peer's userId (uuid)" })
  @IsString()
  peerId: string;
}

export class ChatMessageDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'Stable id for this user pair' })
  conversationId: string;

  @ApiProperty({ format: 'uuid' })
  senderId: string;

  @ApiProperty({ example: 772189 })
  senderZonicId: number | null;

  @ApiProperty({ nullable: true })
  text: string | null;

  @ApiProperty({ nullable: true })
  attachmentFileId: string | null;

  @ApiProperty({ nullable: true, description: "'image' | 'file'" })
  attachmentType: string | null;

  @ApiProperty({ example: '2026-07-07T09:00:00.000Z' })
  sentAt: string;

  @ApiProperty()
  isRead: boolean;
}

export class ChatMessagesResponseDto {
  @ApiProperty({ type: [ChatMessageDto] })
  items: ChatMessageDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

export class ConversationDto {
  @ApiProperty({ format: 'uuid' })
  conversationId: string;

  @ApiProperty({ format: 'uuid' })
  peerId: string;

  @ApiProperty({ nullable: true, example: 772189 })
  peerZonicId: number | null;

  @ApiProperty({ nullable: true })
  peerUsername: string | null;

  @ApiProperty({ nullable: true })
  peerAvatarFileId: string | null;

  @ApiProperty({ description: 'Peer currently connected to /hubs/chat' })
  peerOnline: boolean;

  @ApiProperty({ nullable: true, example: '2026-07-07T09:00:00.000Z', description: 'Last time peer was online' })
  peerLastSeenAt: string | null;

  @ApiProperty({ nullable: true, description: 'Preview of the last message (text or attachment marker)' })
  lastMessageText: string | null;

  @ApiProperty({ nullable: true, description: "'image' | 'file' if the last message was an attachment" })
  lastAttachmentType: string | null;

  @ApiProperty({ nullable: true, example: '2026-07-07T09:00:00.000Z' })
  lastMessageAt: string | null;

  @ApiProperty({ example: 3, description: 'Unread messages from this peer' })
  unreadCount: number;
}

export class ConversationsResponseDto {
  @ApiProperty({ type: [ConversationDto] })
  items: ConversationDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

export class DeleteConversationDto {
  @ApiProperty({ format: 'uuid', description: "Peer's userId — clears this chat for you" })
  @IsString()
  peerId: string;
}

export class DeleteMessageDto {
  @ApiProperty({ format: 'uuid', description: 'Message id (your own message)' })
  @IsString()
  messageId: string;
}

export class PresenceQueryDto {
  @ApiProperty({ format: 'uuid', description: "Peer's userId (uuid)" })
  @IsString()
  peerId: string;
}

export class PresenceDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ description: 'Currently connected to /hubs/chat' })
  online: boolean;

  @ApiProperty({ nullable: true, example: '2026-07-07T09:00:00.000Z' })
  lastSeenAt: string | null;
}

export class UploadAttachmentResponseDto {
  @ApiProperty()
  fileId: string;

  @ApiProperty({ description: "'image' | 'file'" })
  attachmentType: string;
}

export class ChatOkDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Ids marked read (for MarkRead)' })
  messageIds?: string[];
}
