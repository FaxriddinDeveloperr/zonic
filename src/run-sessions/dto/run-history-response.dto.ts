// Mirrors RunHistoryResponseDto.cs (RunHistoryItemDto + RunSummaryDto)
import { ApiProperty } from '@nestjs/swagger';

export class RunHistoryItemDto {
  @ApiProperty({ example: '06.06.2026' })
  date: string;

  @ApiProperty({ example: '07:27' })
  startedAt: string;

  @ApiProperty({ example: '00:34:12' })
  duration: string;

  @ApiProperty({ description: 'km' })
  distance: number;

  @ApiProperty({ description: 'km/h' })
  avgSpeed: number;

  @ApiProperty({ example: 'Zone Capture' })
  runType: string;
}

export class RunSummaryDto {
  @ApiProperty()
  avgSpeed: number;

  @ApiProperty()
  avgDistance: number;

  @ApiProperty({ example: '00:00:00' })
  avgDuration: string;
}

export class RunHistoryResponseDto {
  @ApiProperty({ type: [RunHistoryItemDto] })
  runs: RunHistoryItemDto[];

  @ApiProperty({ type: RunSummaryDto })
  summary: RunSummaryDto;
}
