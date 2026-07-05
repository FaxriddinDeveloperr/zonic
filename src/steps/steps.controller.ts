// Routes under /Steps ([Authorize]).
import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { StepsService } from './steps.service';
import { SaveStepsDto } from './dto/save-steps.dto';
import { SaveDailyStepsDto } from './dto/save-daily-steps.dto';
import { PageQueryDto } from '../free-run/dto/page-query.dto';
import { StepsHistoryResponseDto, TodayStepsDto } from './dto/steps-response.dto';

@ApiTags('Steps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Steps')
export class StepsController {
  constructor(private readonly stepsService: StepsService) {}

  @Post('Save')
  @HttpCode(200)
  @ApiOperation({ summary: "Save steps (upserts the day's total — re-sending never double-counts)" })
  save(@CurrentUser() user: AuthUser, @Body() dto: SaveStepsDto): Promise<{ id: string }> {
    return this.stepsService.save(user.userId, dto);
  }

  @Post('SaveDaily')
  @HttpCode(200)
  @ApiOperation({ summary: "Daily pedometer: send the day's cumulative total (upsert). Recommended." })
  saveDaily(@CurrentUser() user: AuthUser, @Body() dto: SaveDailyStepsDto): Promise<{ id: string }> {
    return this.stepsService.saveDaily(user.userId, dto);
  }

  @Get('Today')
  @ApiOperation({ summary: "Today's steps + goal + distance/calories/progress" })
  @ApiOkResponse({ type: TodayStepsDto })
  today(@CurrentUser() user: AuthUser): Promise<TodayStepsDto> {
    return this.stepsService.today(user.userId);
  }

  @Get('GetHistory')
  @ApiOperation({ summary: "Paginated history of the authenticated user's step sessions" })
  @ApiOkResponse({ type: StepsHistoryResponseDto })
  getHistory(
    @CurrentUser() user: AuthUser,
    @Query() query: PageQueryDto,
  ): Promise<StepsHistoryResponseDto> {
    return this.stepsService.getHistory(user.userId, query.resolvedPage, query.resolvedPageSize);
  }
}
