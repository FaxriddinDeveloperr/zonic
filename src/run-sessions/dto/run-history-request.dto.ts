// Mirrors RunHistoryRequestDto.cs ([FromQuery] flags)
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

const toBool = ({ value }: { value: unknown }): boolean =>
  value === true || value === 'true' || value === '1';

export class RunHistoryRequestDto {
  @ApiPropertyOptional({ type: Boolean })
  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  isWeekly: boolean = false;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  isMonthly: boolean = false;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  isYearly: boolean = false;
}
