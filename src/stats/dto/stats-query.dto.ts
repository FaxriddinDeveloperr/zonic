// Query for GET /UserProfile/GetStats — one of the 3 dimensions × one of the 3 periods.
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum StatsDimension {
  Running = 'running',
  Territory = 'territory',
  Steps = 'steps',
}

export enum StatsPeriod {
  Weekly = 'weekly',
  Monthly = 'monthly',
  Yearly = 'yearly',
}

export class StatsQueryDto {
  @ApiPropertyOptional({ enum: StatsDimension, default: StatsDimension.Running })
  @IsOptional()
  @IsEnum(StatsDimension)
  dimension: StatsDimension = StatsDimension.Running;

  @ApiPropertyOptional({ enum: StatsPeriod, default: StatsPeriod.Weekly })
  @IsOptional()
  @IsEnum(StatsPeriod)
  period: StatsPeriod = StatsPeriod.Weekly;
}
