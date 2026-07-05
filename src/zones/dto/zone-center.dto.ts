// GET /Zone/GetCenterFor?zonicId= — the centre of a user's territories, so the camera can fly
// to a friend's zone anywhere on the map before loading it with GetArea.
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class ZoneCenterQueryDto {
  @ApiProperty({ example: 647307, description: "Target user's ZONIC-ID" })
  @Type(() => Number)
  @IsInt()
  zonicId: number;
}

export class ZoneCenterDto {
  @ApiProperty({ example: 41.311 })
  lat: number;

  @ApiProperty({ example: 69.24 })
  lng: number;
}
