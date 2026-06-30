// Profile Statistics, Personal Bests & Achievements — routes under /UserProfile (JWT required).
// Distinct paths from the existing UserProfileController (GetRunHistory/GetLeaderboard), so the
// two controllers coexist on the same prefix without collision.
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { StatsService } from './stats.service';
import { StatsQueryDto } from './dto/stats-query.dto';
import { StatsResponseDto } from './dto/stats-response.dto';
import { PersonalBestsResponseDto } from './dto/personal-bests.dto';
import { AchievementsResponseDto } from './dto/achievements.dto';

@ApiTags('UserProfile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('UserProfile')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('GetStats')
  @ApiOperation({
    summary: 'Statistics cards + chart for a dimension (running/territory/steps) and period',
  })
  @ApiOkResponse({ type: StatsResponseDto })
  getStats(
    @CurrentUser() user: AuthUser,
    @Query() query: StatsQueryDto,
  ): Promise<StatsResponseDto> {
    return this.statsService.getStats(user.userId, query.dimension, query.period);
  }

  @Get('GetPersonalBests')
  @ApiOperation({ summary: 'All-time personal records (fastest, longest, largest territory)' })
  @ApiOkResponse({ type: PersonalBestsResponseDto })
  getPersonalBests(@CurrentUser() user: AuthUser): Promise<PersonalBestsResponseDto> {
    return this.statsService.getPersonalBests(user.userId);
  }

  @Get('GetAchievements')
  @ApiOperation({ summary: 'Distance & territory badges with progress and unlock state' })
  @ApiOkResponse({ type: AchievementsResponseDto })
  getAchievements(@CurrentUser() user: AuthUser): Promise<AchievementsResponseDto> {
    return this.statsService.getAchievements(user.userId);
  }
}
