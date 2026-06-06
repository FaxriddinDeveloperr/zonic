// Mirrors LeaderboardRequestDto.cs (Page = 1, PageSize = 20 defaults)
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class LeaderboardRequestDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  pageSize: number = 20;
}
