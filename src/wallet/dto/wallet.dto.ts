// Wallet read + daily-reward responses (Phase J).
import { ApiProperty } from '@nestjs/swagger';

export class WalletDto {
  @ApiProperty({ example: 12500, description: 'Persistent coin balance (spent in Market)' })
  tanga: number;

  @ApiProperty({ example: 9000, description: 'Current XP (expires after the retention window)' })
  xp: number;

  @ApiProperty({
    example: '2026-07-01T00:00:00.000Z',
    nullable: true,
    description: 'When the current XP expires (null if no XP)',
  })
  xpExpiresAt: string | null;
}

export class DailyRewardDto {
  @ApiProperty({ example: 8.4, description: 'km counted in this reward window' })
  km: number;

  @ApiProperty({ example: 5200, description: 'steps counted' })
  steps: number;

  @ApiProperty({ example: 2, description: 'territory captures (hexagons) counted' })
  hexagons: number;

  @ApiProperty({ example: 1300, description: 'Tanga awarded' })
  tangaEarned: number;

  @ApiProperty({ example: 13000, description: 'XP awarded' })
  xpEarned: number;

  @ApiProperty({ example: 13800, description: 'New Tanga balance' })
  tanga: number;

  @ApiProperty({ example: 13000, description: 'New XP balance' })
  xp: number;
}
