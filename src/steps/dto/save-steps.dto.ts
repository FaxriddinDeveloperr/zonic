// POST /Steps/Save body — one completed pedometer session. Dates accept ISO or "dd.MM.yyyy HH:mm:ss".
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SaveStepsDto {
  @ApiProperty({ example: '2026-06-30T08:00:00.000Z' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '2026-06-30T08:45:00.000Z' })
  @IsString()
  endTime: string;

  @ApiProperty({ example: 2700, description: 'seconds' })
  @IsInt()
  @Min(0)
  durationSeconds: number;

  @ApiProperty({ example: 4200 })
  @IsInt()
  @Min(0)
  steps: number;

  @ApiPropertyOptional({ example: 3.1, description: 'optional distance estimate (km)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;
}
