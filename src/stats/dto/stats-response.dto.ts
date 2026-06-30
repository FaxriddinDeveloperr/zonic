// Response for GET /UserProfile/GetStats: top summary cards + chart series for the selected
// dimension/period. Fields not relevant to the chosen dimension stay 0 — the mobile tab reads
// only the metrics it shows (Running → distance/speed/time, Territory → area, Steps → steps).
import { ApiProperty } from '@nestjs/swagger';
import { StatsDimension, StatsPeriod } from './stats-query.dto';

export class StatsSummaryDto {
  @ApiProperty({ example: 12, description: 'Number of activities in the selected period' })
  activityCount: number;

  // Running
  @ApiProperty({ example: 47.3, description: 'km — total distance (running)' })
  totalDistanceKm: number;

  @ApiProperty({ example: 3.94, description: 'km — average distance per run' })
  avgDistanceKm: number;

  @ApiProperty({ example: 11.2, description: 'km/h — average speed' })
  avgSpeedKmh: number;

  @ApiProperty({ example: 5.35, description: 'min/km — average pace (0 if unknown)' })
  avgPaceMinPerKm: number;

  @ApiProperty({ example: 15240, description: 'seconds — total moving time' })
  totalDurationSeconds: number;

  @ApiProperty({ example: '00:42:21', description: 'hh:mm:ss — average activity duration' })
  avgDuration: string;

  // Territory
  @ApiProperty({ example: 1.842, description: 'km² — total captured area in the period' })
  totalAreaKm2: number;

  @ApiProperty({ example: 0.153, description: 'km² — average captured area per session' })
  avgAreaKm2: number;

  // Steps (not yet tracked — always 0 until the pedometer feature ships)
  @ApiProperty({ example: 0, description: 'total steps in the period' })
  totalSteps: number;

  @ApiProperty({ example: 0, description: 'average steps per day' })
  avgSteps: number;
}

export class StatsChartPointDto {
  @ApiProperty({ example: '12.06', description: "Bucket label ('dd.MM' daily, 'MM.yyyy' monthly)" })
  label: string;

  @ApiProperty({ example: 3.2, description: 'Bucket value in the dimension unit (km / km² / steps)' })
  value: number;
}

export class StatsResponseDto {
  @ApiProperty({ enum: StatsDimension })
  dimension: StatsDimension;

  @ApiProperty({ enum: StatsPeriod })
  period: StatsPeriod;

  @ApiProperty({ example: 'km', description: "Chart unit: 'km' | 'km²' | 'steps'" })
  unit: string;

  @ApiProperty({ type: StatsSummaryDto })
  summary: StatsSummaryDto;

  @ApiProperty({ type: [StatsChartPointDto] })
  chart: StatsChartPointDto[];
}
