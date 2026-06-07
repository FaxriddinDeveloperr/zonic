// Response shapes for GET /FreeRun/GetHistory and /FreeRun/GetLeaderboard.
// Dates are returned as ISO 8601 (Dart DateTime.parse compatible).
import { ApiProperty } from '@nestjs/swagger';

export class FreeRunRoutePointDto {
  @ApiProperty({ example: 41.311081 })
  lat: number;

  @ApiProperty({ example: 69.240562 })
  lng: number;

  @ApiProperty({ example: '2026-06-07T09:57:10.000Z' })
  ts: string;
}

export class FreeRunItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '2026-06-07T09:57:10.000Z' })
  startTime: string;

  @ApiProperty({ example: '2026-06-07T10:07:10.000Z' })
  endTime: string;

  @ApiProperty({ example: 600 })
  durationSeconds: number;

  @ApiProperty({ example: 5.2, description: 'minutes per km' })
  paceMinPerKm: number;

  @ApiProperty({ example: 11.5, description: 'km/h' })
  averageSpeedKmh: number;

  @ApiProperty({ example: 1.91, description: 'km' })
  distanceKm: number;

  @ApiProperty({ type: [FreeRunRoutePointDto] })
  routePoints: FreeRunRoutePointDto[];
}

export class FreeRunHistoryResponseDto {
  @ApiProperty({ type: [FreeRunItemDto] })
  items: FreeRunItemDto[];
}

export class FreeRunLeaderboardItemDto {
  @ApiProperty({ example: 1 })
  rank: number;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ example: 47.3, description: 'km' })
  totalDistanceKm: number;

  @ApiProperty({ example: 12 })
  totalRuns: number;

  @ApiProperty({ example: 4.15, description: 'best (lowest) pace, minutes per km' })
  bestPaceMinPerKm: number;

  @ApiProperty({ example: 12.4, description: 'km/h' })
  averageSpeedKmh: number;
}

export class FreeRunLeaderboardResponseDto {
  @ApiProperty({ type: [FreeRunLeaderboardItemDto] })
  items: FreeRunLeaderboardItemDto[];
}
