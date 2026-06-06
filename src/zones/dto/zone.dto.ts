// Mirrors ZoneDto.cs
import { ApiProperty } from '@nestjs/swagger';

export class ZoneDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'tx35p87' })
  geohash: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ApiProperty({ nullable: true })
  ownerUsername: string | null;

  @ApiProperty({ nullable: true, example: '05.06.2026', description: 'Formatted "dd.MM.yyyy"' })
  capturedAt: string | null;

  @ApiProperty()
  minLat: number;

  @ApiProperty()
  minLng: number;

  @ApiProperty()
  maxLat: number;

  @ApiProperty()
  maxLng: number;
}
