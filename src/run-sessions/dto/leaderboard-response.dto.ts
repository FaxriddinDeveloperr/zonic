// Mirrors LeaderboardResponseDto.cs (LeaderboardItemDto)
import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardItemDto {
  @ApiProperty()
  rank: number;

  @ApiProperty({ description: "Ranked user's id (uuid)" })
  userId: string;

  @ApiProperty({ nullable: true, example: 772189, description: 'ZONIC-ID — use to send a friend request' })
  zonicId: number | null;

  @ApiProperty()
  username: string;

  @ApiProperty({ description: 'km' })
  totalDistance: number;
}

export class LeaderboardResponseDto {
  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty({ type: [LeaderboardItemDto] })
  items: LeaderboardItemDto[];
}
