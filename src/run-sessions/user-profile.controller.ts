// Port of Zonic.Api/Controllers/UserProfileController.cs  →  routes under /UserProfile  ([Authorize])
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { RunSessionService } from './run-session.service';
import { RunHistoryRequestDto } from './dto/run-history-request.dto';
import { LeaderboardRequestDto } from './dto/leaderboard-request.dto';
import { RunHistoryResponseDto } from './dto/run-history-response.dto';
import { LeaderboardResponseDto } from './dto/leaderboard-response.dto';

@ApiTags('UserProfile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('UserProfile')
export class UserProfileController {
  constructor(private readonly runSessionService: RunSessionService) {}

  @Get('GetRunHistory')
  @ApiOperation({ summary: 'Run history with aggregate summary for the authenticated user' })
  @ApiOkResponse({ type: RunHistoryResponseDto })
  getRunHistory(
    @CurrentUser() user: AuthUser,
    @Query() request: RunHistoryRequestDto,
  ): Promise<RunHistoryResponseDto> {
    return this.runSessionService.getRunHistory(user.userId, request);
  }

  @Get('GetLeaderboard')
  @ApiOperation({ summary: 'Paginated leaderboard ranked by total distance' })
  @ApiOkResponse({ type: LeaderboardResponseDto })
  getLeaderboard(@Query() request: LeaderboardRequestDto): Promise<LeaderboardResponseDto> {
    return this.runSessionService.getLeaderboard(request);
  }
}
