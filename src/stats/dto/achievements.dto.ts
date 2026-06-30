// Response for GET /UserProfile/GetAchievements — badge progress grouped by family.
// Each badge shows its unlock state plus a progress ratio/text so the UI can render "45/100".
import { ApiProperty } from '@nestjs/swagger';

export class AchievementDto {
  @ApiProperty({ example: 'dist_100', description: 'Stable badge code' })
  code: string;

  @ApiProperty({ example: 'distance', description: "'distance' | 'territory'" })
  type: string;

  @ApiProperty({ example: '100 km' })
  title: string;

  @ApiProperty({ example: 100, description: 'Lifetime total needed to unlock' })
  threshold: number;

  @ApiProperty({ example: 'km', description: "'km' | 'km²'" })
  unit: string;

  @ApiProperty({ example: 45, description: 'Current lifetime total (same unit as threshold)' })
  current: number;

  @ApiProperty({ example: 0.45, description: 'Progress 0..1 (capped at 1)' })
  progress: number;

  @ApiProperty({ example: '45/100', description: 'Human-readable progress' })
  progressText: string;

  @ApiProperty({ example: false })
  isUnlocked: boolean;

  @ApiProperty({
    example: '24.10.2026',
    nullable: true,
    description: 'dd.MM.yyyy — unlock date, null while locked',
  })
  unlockedAt: string | null;
}

export class AchievementsResponseDto {
  @ApiProperty({ type: [AchievementDto] })
  distance: AchievementDto[];

  @ApiProperty({ type: [AchievementDto] })
  territory: AchievementDto[];
}
