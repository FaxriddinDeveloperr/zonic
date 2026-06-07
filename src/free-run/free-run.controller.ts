// Routes under /FreeRun ([Authorize]).
import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { FreeRunService } from './free-run.service';
import { SaveFreeRunDto } from './dto/save-free-run.dto';
import { PageQueryDto } from './dto/page-query.dto';
import {
  FreeRunHistoryResponseDto,
  FreeRunLeaderboardResponseDto,
} from './dto/free-run-response.dto';

@ApiTags('FreeRun')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('FreeRun')
export class FreeRunController {
  constructor(private readonly freeRunService: FreeRunService) {}

  @Post('Save')
  @HttpCode(200)
  @ApiOperation({ summary: 'Save a completed free run session' })
  save(@CurrentUser() user: AuthUser, @Body() dto: SaveFreeRunDto): Promise<{ id: string }> {
    return this.freeRunService.save(user.userId, dto);
  }

  @Get('GetHistory')
  @ApiOperation({ summary: "Paginated history of the authenticated user's free runs" })
  @ApiOkResponse({ type: FreeRunHistoryResponseDto })
  getHistory(
    @CurrentUser() user: AuthUser,
    @Query() query: PageQueryDto,
  ): Promise<FreeRunHistoryResponseDto> {
    return this.freeRunService.getHistory(user.userId, query.resolvedPage, query.resolvedPageSize);
  }

  @Get('GetLeaderboard')
  @ApiOperation({ summary: 'Leaderboard ranked by total free-run distance' })
  @ApiOkResponse({ type: FreeRunLeaderboardResponseDto })
  getLeaderboard(@Query() query: PageQueryDto): Promise<FreeRunLeaderboardResponseDto> {
    return this.freeRunService.getLeaderboard(query.resolvedPage, query.resolvedPageSize);
  }
}
