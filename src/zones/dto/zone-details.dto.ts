// GET /Zone/Details/:id — popup card payload.
import { ApiProperty } from '@nestjs/swagger';

export class ZoneDetailsDto {
  @ApiProperty({ format: 'uuid' })
  zoneId: string;

  @ApiProperty({ format: 'uuid' })
  ownerUserId: string;

  @ApiProperty({ nullable: true, example: 772189, description: 'Owner ZONIC-ID — use to friend-request from the map' })
  ownerZonicId: number | null;

  @ApiProperty({ nullable: true })
  ownerUsername: string | null;

  @ApiProperty({ nullable: true, example: 'frame_gold', description: "Owner's equipped avatar frame" })
  ownerSelectedFrameCode: string | null;

  @ApiProperty({ nullable: true, description: 'Avatar file id (GUID) — GET /UserProfile/DownloadAvatar?fileId=…' })
  ownerAvatarFileId: string | null;

  @ApiProperty({ nullable: true, description: 'Relative URL to DownloadAvatar, or null' })
  ownerAvatarUrl: string | null;

  @ApiProperty({ example: 0.45, description: 'km²' })
  areaKm2: number;

  @ApiProperty({ nullable: true, example: '07.06.2026 15:30:00' })
  capturedAt: string | null;
}
