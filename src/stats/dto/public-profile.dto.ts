// Public profile of another player (BACKEND_TODO §3).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class PublicProfileQueryDto {
  // Accept either ?zonicId= (preferred, consistent with the other endpoints) or the legacy ?userId=.
  @ApiPropertyOptional({ example: 772189, description: "Target user's ZONIC-ID (preferred param)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  zonicId?: number;

  @ApiPropertyOptional({ example: 772189, description: 'Alias of zonicId (legacy)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  /** The effective ZONIC-ID from either param. */
  get targetZonicId(): number | undefined {
    return this.zonicId ?? this.userId;
  }
}

export class PublicStatsDto {
  @ApiProperty({ example: 156.4 })
  totalDistanceKm: number;

  @ApiProperty({ example: 4.3, description: 'min/km (0 if unknown)' })
  avgPaceMinPerKm: number;

  @ApiProperty({ example: 12.5 })
  totalAreaKm2: number;

  @ApiProperty({ example: 48 })
  activityCount: number;
}

export class PublicAchievementDto {
  @ApiProperty({ example: 'distance' })
  type: string;

  @ApiProperty({ example: 100 })
  threshold: number;

  @ApiProperty({ example: true })
  isUnlocked: boolean;
}

export class PublicRecentActivityDto {
  @ApiProperty({ example: '2026-06-27', description: 'YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: 5.2 })
  distanceKm: number;

  @ApiProperty({ example: 28 })
  durationMinutes: number;
}

export class PublicProfileDto {
  @ApiProperty({ example: 772189 })
  zonicId: number;

  @ApiProperty()
  username: string;

  @ApiProperty({ nullable: true })
  avatarFileId: string | null;

  @ApiProperty({ example: 'frame_gold', nullable: true, description: 'Equipped avatar frame code' })
  selectedFrameCode: string | null;

  @ApiProperty({ nullable: true })
  coverFileId: string | null;

  @ApiProperty({ example: 12, description: 'Numeric level from lifetime XP' })
  level: number;

  @ApiProperty({ nullable: true })
  bio: string | null;

  @ApiProperty({ nullable: true, example: 'dist_100' })
  selectedBadgeCode: string | null;

  @ApiProperty({ nullable: true, example: 'Город Ташкент' })
  regionName: string | null;

  @ApiProperty({ type: PublicStatsDto })
  stats: PublicStatsDto;

  @ApiProperty({ type: [PublicAchievementDto] })
  achievements: PublicAchievementDto[];

  @ApiProperty({ type: [PublicRecentActivityDto] })
  recentActivities: PublicRecentActivityDto[];
}
