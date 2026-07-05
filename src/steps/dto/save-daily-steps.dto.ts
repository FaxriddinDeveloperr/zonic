// POST /Steps/SaveDaily — send the DAY'S CUMULATIVE step total (upsert; re-sending updates it).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SaveDailyStepsDto {
  @ApiProperty({ example: 5200, description: "Today's cumulative step total (not a delta)" })
  @IsInt()
  @Min(0)
  steps: number;

  @ApiPropertyOptional({ example: '2026-07-03', description: 'YYYY-MM-DD (UTC); defaults to today' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ example: 3.6, description: "Optional distance estimate for the day (km)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;
}
