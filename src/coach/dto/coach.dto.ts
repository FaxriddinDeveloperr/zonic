// AI Coach DTOs (Phase O).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class HeartZoneDto {
  @ApiProperty({ example: 3 })
  zone: number;

  @ApiProperty({ example: 'Aerobic' })
  name: string;

  @ApiProperty({ example: 133, description: 'Lower BPM bound' })
  minBpm: number;

  @ApiProperty({ example: 152, description: 'Upper BPM bound' })
  maxBpm: number;
}

export class ZonesResponseDto {
  @ApiProperty({ example: 28 })
  age: number;

  @ApiProperty({ example: 192, description: 'Estimated max heart rate (220 − age)' })
  maxHr: number;

  @ApiProperty({ type: [HeartZoneDto] })
  zones: HeartZoneDto[];
}

export class CoachFeedbackRequestDto {
  @ApiProperty({ example: 158, description: 'Current heart rate (BPM)' })
  @IsInt()
  @Min(30)
  bpm: number;

  @ApiPropertyOptional({ example: 5.4, description: 'Distance so far (km)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional({ example: 1800, description: 'Elapsed time (seconds)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({ example: 85, description: 'Cadence (steps/min), optional' })
  @IsOptional()
  @IsInt()
  @Min(0)
  cadence?: number;
}

export class CoachFeedbackDto {
  @ApiProperty({ example: 4 })
  zone: number;

  @ApiProperty({ example: 'Threshold' })
  zoneName: string;

  @ApiProperty({ example: 158 })
  bpm: number;

  @ApiProperty({ example: 192 })
  maxHr: number;

  @ApiProperty({ example: 82, description: '% of max HR' })
  percentOfMax: number;

  @ApiProperty({ example: 'warning', description: "'ok' | 'push' | 'ease' | 'warning'" })
  level: string;

  @ApiProperty({ example: 'Yurak urishi yuqori zonada. Tempni biroz ushlab turing.' })
  message: string;

  @ApiProperty({ type: [String], description: 'Extra cues (hydration, cadence, ...)' })
  advice: string[];
}
