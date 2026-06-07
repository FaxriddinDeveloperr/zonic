// POST /FreeRun/Save body. Dates accepted as "dd.MM.yyyy HH:mm:ss" OR ISO 8601 (tolerant parse).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class RoutePointDto {
  @ApiProperty({ example: 41.311081 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 69.240562 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({ example: '07.06.2026 14:57:10', description: 'dd.MM.yyyy HH:mm:ss or ISO 8601' })
  @IsString()
  @IsNotEmpty()
  ts: string;
}

export class SaveFreeRunDto {
  @ApiProperty({ example: '07.06.2026 14:57:10', description: 'dd.MM.yyyy HH:mm:ss or ISO 8601' })
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ example: '07.06.2026 15:07:10', description: 'dd.MM.yyyy HH:mm:ss or ISO 8601' })
  @IsString()
  @IsNotEmpty()
  endTime: string;

  @ApiProperty({ example: 600 })
  @IsInt()
  @Min(0)
  durationSeconds: number;

  @ApiPropertyOptional({ example: 5.2, description: 'minutes per km' })
  @IsOptional()
  @IsNumber()
  paceMinPerKm?: number;

  @ApiPropertyOptional({ example: 11.5, description: 'km/h' })
  @IsOptional()
  @IsNumber()
  averageSpeedKmh?: number;

  @ApiProperty({ type: [RoutePointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  routePoints: RoutePointDto[];
}
