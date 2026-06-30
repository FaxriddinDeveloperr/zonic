// Clan DTOs (Phase M follow-up).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength, IsUUID } from 'class-validator';

export class CreateClanDto {
  @ApiProperty({ example: 'Tashkent Runners', minLength: 2, maxLength: 60 })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ example: '#FF0000', description: 'Clan color (hex)' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex code like #FF0000' })
  color?: string;
}

export class JoinClanDto {
  @ApiProperty()
  @IsUUID()
  clanId: string;
}

export class ClanDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Tashkent Runners' })
  name: string;

  @ApiProperty({ nullable: true, example: '#FF0000' })
  color: string | null;

  @ApiProperty()
  ownerUserId: string;

  @ApiProperty({ example: 12 })
  memberCount: number;

  @ApiProperty({ example: '2026-06-30T10:00:00.000Z' })
  createdAt: string;
}

export class ClanMemberDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ nullable: true, example: 772189 })
  zonicId: number | null;

  @ApiProperty({ example: 'member', description: "'leader' | 'member'" })
  role: string;

  @ApiProperty({ example: '2026-06-30T10:00:00.000Z' })
  joinedAt: string;
}

export class MyClanDto {
  @ApiProperty({ type: ClanDto, nullable: true, description: 'null if not in a clan' })
  clan: ClanDto | null;

  @ApiProperty({ nullable: true, example: 'leader' })
  role: string | null;

  @ApiProperty({ type: [ClanMemberDto] })
  members: ClanMemberDto[];
}

export class ClanListDto {
  @ApiProperty({ type: [ClanDto] })
  items: ClanDto[];
}

export class ClanMembersDto {
  @ApiProperty({ type: [ClanMemberDto] })
  members: ClanMemberDto[];
}

export class ClanLeaderboardItemDto {
  @ApiProperty({ example: 1 })
  rank: number;

  @ApiProperty()
  clanId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 142.6, description: "km — sum of members' run distance" })
  totalDistanceKm: number;

  @ApiProperty({ example: 12 })
  memberCount: number;
}

export class ClanLeaderboardDto {
  @ApiProperty({ type: [ClanLeaderboardItemDto] })
  items: ClanLeaderboardItemDto[];
}

export class ClanOkDto {
  @ApiProperty({ example: true })
  ok: boolean;
}
