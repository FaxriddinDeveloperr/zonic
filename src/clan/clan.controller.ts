// Routes under /Clan ([Authorize]).
import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { ClanService } from './clan.service';
import {
  ClanDto,
  ClanLeaderboardDto,
  ClanListDto,
  ClanMembersDto,
  ClanOkDto,
  CreateClanDto,
  JoinClanDto,
  MyClanDto,
} from './dto/clan.dto';

@ApiTags('Clan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Clan')
export class ClanController {
  constructor(private readonly clan: ClanService) {}

  @Post('Create')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a clan (Gold+); creator becomes leader' })
  @ApiOkResponse({ type: ClanDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateClanDto): Promise<ClanDto> {
    return this.clan.create(user.userId, dto.name, dto.color);
  }

  @Get('List')
  @ApiOperation({ summary: 'Browse clans to join' })
  @ApiOkResponse({ type: ClanListDto })
  list(@Query('page') page = '1', @Query('pageSize') pageSize = '20'): Promise<ClanListDto> {
    return this.clan.list(Math.max(1, Number(page) || 1), Math.max(1, Number(pageSize) || 20));
  }

  @Get('Mine')
  @ApiOperation({ summary: "The caller's clan, role and members (clan = null if none)" })
  @ApiOkResponse({ type: MyClanDto })
  mine(@CurrentUser() user: AuthUser): Promise<MyClanDto> {
    return this.clan.mine(user.userId);
  }

  @Post('Join')
  @HttpCode(200)
  @ApiOperation({ summary: 'Join an existing clan' })
  @ApiOkResponse({ type: ClanOkDto })
  join(@CurrentUser() user: AuthUser, @Body() dto: JoinClanDto): Promise<ClanOkDto> {
    return this.clan.join(user.userId, dto.clanId);
  }

  @Post('Leave')
  @HttpCode(200)
  @ApiOperation({ summary: 'Leave your clan (leader leaving as last member disbands it)' })
  @ApiOkResponse({ type: ClanOkDto })
  leave(@CurrentUser() user: AuthUser): Promise<ClanOkDto> {
    return this.clan.leave(user.userId);
  }

  @Get('Leaderboard')
  @ApiOperation({ summary: "Clans ranked by members' total run distance" })
  @ApiOkResponse({ type: ClanLeaderboardDto })
  leaderboard(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<ClanLeaderboardDto> {
    return this.clan.leaderboard(Math.max(1, Number(page) || 1), Math.max(1, Number(pageSize) || 20));
  }

  @Get(':id/Members')
  @ApiOperation({ summary: 'List a clan’s members' })
  @ApiOkResponse({ type: ClanMembersDto })
  membersOf(@Param('id') id: string): Promise<ClanMembersDto> {
    return this.clan.members(id);
  }
}
