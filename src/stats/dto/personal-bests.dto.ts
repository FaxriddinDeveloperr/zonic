// Response for GET /UserProfile/GetPersonalBests — all-time best results, each with its date.
// Computed live from existing data (game_free_run, game_territory); null until the user has any.
import { ApiProperty } from '@nestjs/swagger';

export class PersonalBestDto {
  @ApiProperty({ example: 14.2, description: 'The record value' })
  value: number;

  @ApiProperty({ example: '24.10.2026', description: 'dd.MM.yyyy — when the record was set' })
  date: string;
}

export class PersonalBestsResponseDto {
  @ApiProperty({
    type: PersonalBestDto,
    nullable: true,
    description: 'km/h — fastest average speed in a single run',
  })
  fastestSpeedKmh: PersonalBestDto | null;

  @ApiProperty({
    type: PersonalBestDto,
    nullable: true,
    description: 'km — longest distance in a single run',
  })
  longestDistanceKm: PersonalBestDto | null;

  @ApiProperty({
    type: PersonalBestDto,
    nullable: true,
    description: 'km² — largest territory captured in one attempt',
  })
  largestTerritoryKm2: PersonalBestDto | null;
}
