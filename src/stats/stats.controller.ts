// Profile Statistics, Personal Bests & Achievements — routes under /UserProfile (JWT required).
// Distinct paths from the existing UserProfileController (GetRunHistory/GetLeaderboard), so the
// two controllers coexist on the same prefix without collision.
import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { StatsService } from './stats.service';
import { StatsQueryDto } from './dto/stats-query.dto';
import { StatsResponseDto } from './dto/stats-response.dto';
import { PersonalBestsResponseDto } from './dto/personal-bests.dto';
import { AchievementsQueryDto, AchievementsResponseDto } from './dto/achievements.dto';
import { PublicProfileDto, PublicProfileQueryDto } from './dto/public-profile.dto';

@ApiTags('UserProfile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('UserProfile')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('GetStats')
  @ApiOperation({
    summary: 'Statistics cards + chart. Optional ?zonicId= views another user; omit for your own',
  })
  @ApiOkResponse({ type: StatsResponseDto })
  async getStats(
    @CurrentUser() user: AuthUser,
    @Query() query: StatsQueryDto,
  ): Promise<StatsResponseDto> {
    const targetId = await this.statsService.resolveUserId(user.userId, query.zonicId);
    return this.statsService.getStats(targetId, query.dimension, query.period);
  }

  @Get('GetPersonalBests')
  @ApiOperation({ summary: 'All-time personal records. Optional ?zonicId= views another user' })
  @ApiOkResponse({ type: PersonalBestsResponseDto })
  async getPersonalBests(
    @CurrentUser() user: AuthUser,
    @Query() query: AchievementsQueryDto,
  ): Promise<PersonalBestsResponseDto> {
    const targetId = await this.statsService.resolveUserId(user.userId, query.zonicId);
    return this.statsService.getPersonalBests(targetId);
  }

  @Get('GetAchievements')
  @ApiOperation({ summary: 'Badges with progress. Optional ?zonicId= views another user' })
  @ApiOkResponse({ type: AchievementsResponseDto })
  async getAchievements(
    @CurrentUser() user: AuthUser,
    @Query() query: AchievementsQueryDto,
  ): Promise<AchievementsResponseDto> {
    const targetId = await this.statsService.resolveUserId(user.userId, query.zonicId);
    return this.statsService.getAchievements(targetId);
  }

  @Get('GetPublicProfile')
  @ApiOperation({ summary: 'Another player’s public profile by ZONIC-ID (stats + achievements)' })
  @ApiOkResponse({ type: PublicProfileDto })
  getPublicProfile(@Query() q: PublicProfileQueryDto): Promise<PublicProfileDto> {
    const zonicId = q.targetZonicId;
    if (zonicId == null) throw new BadRequestException('zonicId is required.');
    return this.statsService.getPublicProfile(zonicId);
  }
}
