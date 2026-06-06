// Mirrors LeaderboardResponseDto.cs (LeaderboardItemDto)
import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardItemDto {
  @ApiProperty()
  rank: number;

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
