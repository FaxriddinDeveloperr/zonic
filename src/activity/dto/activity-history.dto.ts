// Unified Activity History (Phase F) — one feed merging running / territory / steps, filterable
// by type, each card carrying the geometry the UI draws on expand (polyline vs filled polygon).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export enum ActivityType {
  All = 'all',
  Running = 'running',
  Territory = 'territory',
  Steps = 'steps',
}

export class ActivityHistoryQueryDto {
  @ApiPropertyOptional({ enum: ActivityType, default: ActivityType.All })
  @IsOptional()
  @IsEnum(ActivityType)
  type: ActivityType = ActivityType.All;

  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number = 20;
}

export class LatLng {
  @ApiProperty({ example: 41.311 })
  lat: number;

  @ApiProperty({ example: 69.24 })
  lng: number;
}

export class ActivityItemDto {
  @ApiProperty({ example: 'running', description: "'running' | 'territory' | 'steps'" })
  type: string;

  @ApiProperty()
  id: string;

  @ApiProperty({ example: '12.06.2026', description: 'dd.MM.yyyy' })
  date: string;

  @ApiProperty({ example: '08:30', description: 'HH:mm' })
  time: string;

  @ApiProperty({ example: 2700, description: 'seconds (0 for territory)' })
  durationSeconds: number;

  @ApiProperty({ example: 5.4, description: 'Main metric: km (running) / km² (territory) / steps' })
  value: number;

  @ApiProperty({ example: 'km', description: "'km' | 'km²' | 'steps'" })
  unit: string;

  @ApiProperty({
    type: [LatLng],
    nullable: true,
    description: 'Running route (Polyline). Null for territory/steps.',
  })
  polyline: LatLng[] | null;

  @ApiProperty({
    type: 'array',
    nullable: true,
    description: 'Territory rings (filled Polygon parts). Null for running/steps.',
    items: { type: 'array', items: { $ref: '#/components/schemas/LatLng' } },
  })
  polygons: LatLng[][] | null;
}

export class ActivityHistoryResponseDto {
  @ApiProperty({ example: 42 })
  totalCount: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ type: [ActivityItemDto] })
  items: ActivityItemDto[];
}
