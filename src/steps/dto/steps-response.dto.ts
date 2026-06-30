// Response shapes for /Steps endpoints. Dates returned as ISO 8601.
import { ApiProperty } from '@nestjs/swagger';

export class StepActivityItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '2026-06-30T08:00:00.000Z' })
  startTime: string;

  @ApiProperty({ example: '2026-06-30T08:45:00.000Z' })
  endTime: string;

  @ApiProperty({ example: 2700 })
  durationSeconds: number;

  @ApiProperty({ example: 4200 })
  steps: number;

  @ApiProperty({ example: 3.1, description: 'km (0 if not provided)' })
  distanceKm: number;
}

export class StepsHistoryResponseDto {
  @ApiProperty({ type: [StepActivityItemDto] })
  items: StepActivityItemDto[];
}
