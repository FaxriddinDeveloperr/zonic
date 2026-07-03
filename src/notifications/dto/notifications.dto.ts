// Notification DTOs (BACKEND_TODO §2).
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class NotificationDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'friend_request', description: 'friend_request|achievement|clan|challenge|system' })
  type: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true })
  body: string | null;

  @ApiProperty({ example: '2026-07-03T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ example: { requestId: 'uuid', zonicId: 772189 }, description: 'Type-specific data' })
  payload: Record<string, unknown>;
}

export class NotificationsResponseDto {
  @ApiProperty({ type: [NotificationDto] })
  items: NotificationDto[];

  @ApiProperty({ example: 4 })
  unreadCount: number;
}

export class MarkReadDto {
  @ApiProperty({
    type: [String],
    required: false,
    description: 'Ids to mark read; omit/empty = mark ALL read',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];
}

export class OkDto {
  @ApiProperty({ example: true })
  ok: boolean;
}
