// Challenge / Duel DTOs (Phase I).
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsString, Min } from 'class-validator';

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

  @ApiProperty({ example: 500, description: 'Tanga staked' })
  @IsInt()
  @Min(0)
  bet: number;
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

  @ApiProperty({ example: 500 })
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
