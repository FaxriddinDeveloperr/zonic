// Unified activity history — route under /UserProfile (JWT). Coexists with the other
// /UserProfile controllers (distinct path).
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { ActivityService } from './activity.service';
import { ActivityHistoryQueryDto, ActivityHistoryResponseDto } from './dto/activity-history.dto';

@ApiTags('UserProfile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('UserProfile')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('GetActivityHistory')
  @ApiOperation({
    summary: 'Unified activity feed (running/territory/steps) with geometry, filterable by type',
  })
  @ApiOkResponse({ type: ActivityHistoryResponseDto })
  getActivityHistory(
    @CurrentUser() user: AuthUser,
    @Query() query: ActivityHistoryQueryDto,
  ): Promise<ActivityHistoryResponseDto> {
    return this.activityService.getHistory(user.userId, query.type, query.page, query.pageSize);
  }
}
