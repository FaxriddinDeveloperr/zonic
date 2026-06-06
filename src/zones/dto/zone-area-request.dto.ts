// Mirrors ZoneAreaRequestDto.cs ([FromQuery] bounding box)
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class ZoneAreaRequestDto {
  @ApiProperty({ type: Number, example: 41.2 })
  @Type(() => Number)
  @IsNumber()
  minLat: number;

  @ApiProperty({ type: Number, example: 69.1 })
  @Type(() => Number)
  @IsNumber()
  minLng: number;

  @ApiProperty({ type: Number, example: 41.4 })
  @Type(() => Number)
  @IsNumber()
  maxLat: number;

  @ApiProperty({ type: Number, example: 69.4 })
  @Type(() => Number)
  @IsNumber()
  maxLng: number;
}
