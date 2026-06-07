// Pagination query that accepts BOTH "Page/PageSize" (what the app sends) and "page/pageSize".
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PageQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  Page?: number;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  PageSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  /** Resolve effective page (1-based), preferring capitalized keys. */
  get resolvedPage(): number {
    return this.Page ?? this.page ?? 1;
  }

  get resolvedPageSize(): number {
    return this.PageSize ?? this.pageSize ?? 20;
  }
}
