// Routes under /Challenge ([Authorize]).
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { ChallengesService } from './challenges.service';
import {
  ChallengeDto,
  ChallengeListDto,
  ChallengeOkDto,
  CreateChallengeDto,
  FinishChallengeDto,
  RespondChallengeDto,
} from './dto/challenge.dto';

@ApiTags('Challenge')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Challenge')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Post('Create')
  @HttpCode(200)
  @ApiOperation({ summary: 'Challenge a friend (goal type, start time, Tanga bet)' })
  @ApiOkResponse({ type: ChallengeDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChallengeDto): Promise<ChallengeDto> {
    return this.challenges.create(user.userId, dto.opponentZonicId, dto.goalType, dto.startAt, dto.bet);
  }

  @Post('Respond')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept or decline a challenge' })
  @ApiOkResponse({ type: ChallengeOkDto })
  respond(@CurrentUser() user: AuthUser, @Body() dto: RespondChallengeDto): Promise<ChallengeOkDto> {
    return this.challenges.respond(user.userId, dto.challengeId, dto.accept);
  }

  @Get('List')
  @ApiOperation({ summary: "The caller's challenges (incoming + outgoing) with derived status" })
  @ApiOkResponse({ type: ChallengeListDto })
  list(@CurrentUser() user: AuthUser): Promise<ChallengeListDto> {
    return this.challenges.list(user.userId);
  }

  @Post('Finish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Settle an accepted duel — pays the pot to the winner (2×bet)' })
  @ApiOkResponse({ type: ChallengeDto })
  finish(@CurrentUser() user: AuthUser, @Body() dto: FinishChallengeDto): Promise<ChallengeDto> {
    return this.challenges.finish(user.userId, dto.challengeId);
  }
}
