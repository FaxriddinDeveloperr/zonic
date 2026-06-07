// GET /Zone/Details/:id — popup card payload.
import { ApiProperty } from '@nestjs/swagger';

export class ZoneDetailsDto {
  @ApiProperty({ format: 'uuid' })
  zoneId: string;

  @ApiProperty({ format: 'uuid' })
  ownerUserId: string;

  @ApiProperty({ nullable: true })
  ownerUsername: string | null;

  @ApiProperty({ nullable: true, description: 'Relative URL to DownloadAvatar, or null' })
  ownerAvatarUrl: string | null;

  @ApiProperty({ example: 0.45, description: 'km²' })
  areaKm2: number;

  @ApiProperty({ nullable: true, example: '07.06.2026 15:30:00' })
  capturedAt: string | null;
}
