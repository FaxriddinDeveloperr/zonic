// Mirrors LeaderboardRequestDto.cs (Page = 1, PageSize = 20 defaults) + region scope (Phase H).
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';

/** Region filter — 'country'/'region' rank only users in the requester's country/region. */
export enum LeaderboardScope {
  Global = 'global',
  Country = 'country',
  Region = 'region',
}

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

  @ApiPropertyOptional({
    enum: LeaderboardScope,
    default: LeaderboardScope.Global,
    description: "GLOBAL / UZBEKISTAN(country) / TASHKENT(region) — filters by the caller's profile",
  })
  @IsOptional()
  @IsEnum(LeaderboardScope)
  scope: LeaderboardScope = LeaderboardScope.Global;
}
