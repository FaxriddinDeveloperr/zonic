// Challenge / Duel DTOs (Phase I).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum ChallengeGoal {
  Running = 'running',
  Territory = 'territory',
  Steps = 'steps',
}

export class CreateChallengeDto {
  @ApiProperty({ example: 772189, description: "Opponent's ZONIC-ID (must be a friend)" })
  @IsInt()
  opponentZonicId: number;

  @ApiProperty({ enum: ChallengeGoal, example: 'running' })
  @IsEnum(ChallengeGoal)
  goalType: ChallengeGoal;

  @ApiProperty({ example: '2026-07-01T09:00:00.000Z', description: 'ISO or dd.MM.yyyy HH:mm:ss' })
  @IsString()
  startAt: string;

  @ApiPropertyOptional({
    example: 24,
    description: 'Duration in hours (1–168). Winner is whoever does more between startAt and startAt+duration. Default 24.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  durationHours?: number;
}

export class RespondChallengeDto {
  @ApiProperty()
  @IsString()
  challengeId: string;

  @ApiProperty({ example: true, description: 'true = accept, false = decline' })
  @IsBoolean()
  accept: boolean;
}

export class FinishChallengeDto {
  @ApiProperty()
  @IsString()
  challengeId: string;
}

export class ChallengePartyDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ example: 772189 })
  zonicId: number;
}

export class ChallengeDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: ChallengePartyDto })
  challenger: ChallengePartyDto;

  @ApiProperty({ type: ChallengePartyDto })
  opponent: ChallengePartyDto;

  @ApiProperty({ example: 'running' })
  goalType: string;

  @ApiProperty({ example: '2026-07-01T09:00:00.000Z' })
  startAt: string;

  @ApiProperty({ example: '2026-07-02T09:00:00.000Z', description: 'Window end — winner measured up to here' })
  endAt: string;

  @ApiProperty({ example: 200, description: 'System prize paid to the winner' })
  bet: number;

  @ApiProperty({
    example: 'active',
    description: "pending | accepted | active | declined | finished (derived from start time)",
  })
  status: string;

  @ApiProperty({ example: 'outgoing', description: "'outgoing' | 'incoming' relative to caller" })
  direction: string;

  @ApiProperty({
    nullable: true,
    description: 'Winner user id once finished; null while unfinished or on a tie',
  })
  winnerUserId: string | null;

  @ApiProperty({ example: '2026-06-30T10:00:00.000Z' })
  createdAt: string;
}

export class ChallengeListDto {
  @ApiProperty({ type: [ChallengeDto] })
  challenges: ChallengeDto[];
}

export class ChallengeOkDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ example: 'accepted', nullable: true })
  status?: string;
}
