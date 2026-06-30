// Friends / Clan DTOs (Phase G).
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsUUID } from 'class-validator';

export class MyIdDto {
  @ApiProperty({ example: 772189, description: 'Your unique ZONIC-ID (share / search by this)' })
  zonicId: number;

  @ApiProperty()
  username: string;

  @ApiProperty({ nullable: true })
  avatarFileId: string | null;
}

export class UserSummaryDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ example: 772189 })
  zonicId: number;

  @ApiProperty()
  username: string;

  @ApiProperty({ nullable: true })
  avatarFileId: string | null;

  @ApiProperty({ nullable: true, example: 'beginner' })
  level: string | null;
}

export class FriendDto extends UserSummaryDto {
  @ApiProperty({
    nullable: true,
    example: '2026-06-29T18:20:00.000Z',
    description: 'Last activity time (run/steps/territory), null if none',
  })
  lastActivityAt: string | null;

  @ApiProperty({ example: true, description: 'Has at least one captured territory on the map' })
  hasTerritory: boolean;
}

export class FriendRequestItemDto {
  @ApiProperty({ description: 'Friendship row id — pass to Respond' })
  requestId: string;

  @ApiProperty({ type: UserSummaryDto })
  from: UserSummaryDto;

  @ApiProperty({ example: '2026-06-30T10:00:00.000Z' })
  createdAt: string;
}

export class SearchRequestDto {
  @ApiProperty({ example: 772189 })
  @Type(() => Number)
  @IsInt()
  zonicId: number;
}

export class FriendRequestDto {
  @ApiProperty({ example: 772189, description: 'Target user ZONIC-ID' })
  @IsInt()
  zonicId: number;
}

export class RespondRequestDto {
  @ApiProperty()
  @IsUUID()
  requestId: string;

  @ApiProperty({ example: true, description: 'true = accept, false = reject' })
  @IsBoolean()
  accept: boolean;
}

export class FriendsListDto {
  @ApiProperty({ type: [FriendDto] })
  friends: FriendDto[];
}

export class FriendRequestsDto {
  @ApiProperty({ type: [FriendRequestItemDto] })
  requests: FriendRequestItemDto[];
}

export class OkDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ example: 'accepted', nullable: true })
  status?: string;
}
