// Routes under /Chat ([Authorize]). REST covers everything the socket does, as a fallback and for
// history/attachments. Send also delivers over the socket / push via the gateway.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { ChatService, UploadedFile as MulterFile } from './chat.service';
import { ChatGateway } from './chat.gateway';
import {
  ChatMessageDto,
  ChatMessagesQueryDto,
  ChatMessagesResponseDto,
  ChatOkDto,
  ChatPageQueryDto,
  ConversationsResponseDto,
  MarkChatReadDto,
  SendMessageDto,
  UploadAttachmentResponseDto,
} from './dto/chat.dto';

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  @Get('Conversations')
  @ApiOperation({ summary: 'Conversations: peer, last message preview, unread count' })
  @ApiOkResponse({ type: ConversationsResponseDto })
  conversations(
    @CurrentUser() user: AuthUser,
    @Query() q: ChatPageQueryDto,
  ): Promise<ConversationsResponseDto> {
    return this.chat.getConversations(user.userId, q.Page, q.PageSize);
  }

  @Get('Messages')
  @ApiOperation({ summary: 'Message history with a peer (newest first)' })
  @ApiOkResponse({ type: ChatMessagesResponseDto })
  messages(
    @CurrentUser() user: AuthUser,
    @Query() q: ChatMessagesQueryDto,
  ): Promise<ChatMessagesResponseDto> {
    return this.chat.getMessages(user.userId, q.peerId, q.Page, q.PageSize);
  }

  @Post('Send')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a message (REST fallback); delivers over socket/push too' })
  @ApiOkResponse({ type: ChatMessageDto })
  async send(@CurrentUser() user: AuthUser, @Body() dto: SendMessageDto): Promise<ChatMessageDto> {
    const { message, recipientId, senderUsername } = await this.chat.createMessage(
      user.userId,
      dto.peerId,
      dto.text ?? null,
      dto.attachmentFileId ?? null,
    );
    // Deliver to the recipient (live or push). Don't echo to the sender — they have the HTTP response.
    await this.gateway.deliver(message, recipientId, user.userId, senderUsername, {
      echoToSender: false,
    });
    return message;
  }

  @Post('MarkRead')
  @HttpCode(200)
  @ApiOperation({ summary: "Mark all of a peer's messages to me as read" })
  @ApiOkResponse({ type: ChatOkDto })
  async markRead(@CurrentUser() user: AuthUser, @Body() dto: MarkChatReadDto): Promise<ChatOkDto> {
    const messageIds = await this.chat.markRead(user.userId, dto.peerId);
    this.gateway.emitRead(user.userId, dto.peerId, messageIds);
    return { ok: true, messageIds };
  }

  @Post('UploadAttachment')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a chat attachment (field: file) → fileId + type' })
  @ApiOkResponse({ type: UploadAttachmentResponseDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  uploadAttachment(@UploadedFile() file: MulterFile): UploadAttachmentResponseDto {
    return this.chat.saveAttachment(file);
  }

  @Get('DownloadAttachment')
  @ApiOperation({ summary: 'Download a chat attachment by fileId' })
  downloadAttachment(@Query('fileId') fileId: string): StreamableFile {
    const { stream, contentType } = this.chat.openAttachment(fileId);
    return new StreamableFile(stream, { type: contentType });
  }
}
