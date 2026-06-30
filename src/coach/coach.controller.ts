// Routes under /Coach ([Authorize]; Gold+ enforced in the service).
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { CoachService } from './coach.service';
import { CoachFeedbackDto, CoachFeedbackRequestDto, ZonesResponseDto } from './dto/coach.dto';

@ApiTags('Coach')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Coach')
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  @Get('Zones')
  @ApiOperation({ summary: 'Heart-rate zones from your age (Gold+)' })
  @ApiOkResponse({ type: ZonesResponseDto })
  zones(@CurrentUser() user: AuthUser): Promise<ZonesResponseDto> {
    return this.coach.zones(user.userId);
  }

  @Post('Feedback')
  @HttpCode(200)
  @ApiOperation({ summary: 'Real-time coaching cue from current BPM + context (Gold+)' })
  @ApiOkResponse({ type: CoachFeedbackDto })
  feedback(
    @CurrentUser() user: AuthUser,
    @Body() dto: CoachFeedbackRequestDto,
  ): Promise<CoachFeedbackDto> {
    return this.coach.feedback(user.userId, dto);
  }
}
