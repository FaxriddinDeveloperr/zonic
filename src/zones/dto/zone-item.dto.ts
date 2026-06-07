// Polygon zone shapes returned by /Zone/GetArea and /Zone/GetMyZones.
// pathPolygon is a flat list of {lat,lng} (one polygon ring). A merged MultiPolygon
// is returned as several items sharing the same zoneId (one per polygon part).
import { ApiProperty } from '@nestjs/swagger';

export class LatLngDto {
  @ApiProperty({ example: 41.311081 })
  lat: number;

  @ApiProperty({ example: 69.240562 })
  lng: number;
}

export class ZoneItemDto {
  @ApiProperty({ format: 'uuid' })
  zoneId: string;

  @ApiProperty({ format: 'uuid' })
  ownerUserId: string;

  @ApiProperty({ nullable: true })
  ownerUsername: string | null;

  @ApiProperty({ example: '#FF0000' })
  color: string;

  @ApiProperty({ example: 0.45, description: 'km²' })
  areaKm2: number;

  @ApiProperty({ nullable: true, example: '07.06.2026', description: 'Formatted "dd.MM.yyyy"' })
  capturedAt: string | null;

  @ApiProperty({ type: [LatLngDto] })
  pathPolygon: LatLngDto[];
}
