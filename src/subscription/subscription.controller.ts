// Routes under /Subscription ([Authorize]).
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { SubscriptionService } from './subscription.service';
import { MySubscriptionDto, PlansResponseDto } from './dto/subscription.dto';

@ApiTags('Subscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Subscription')
export class SubscriptionController {
  constructor(private readonly subscription: SubscriptionService) {}

  @Get('Plans')
  @ApiOperation({ summary: 'All tiers with prices and feature flags' })
  @ApiOkResponse({ type: PlansResponseDto })
  plans(): PlansResponseDto {
    return this.subscription.plans();
  }

  @Get('Me')
  @ApiOperation({ summary: "The caller's effective tier, expiry and features" })
  @ApiOkResponse({ type: MySubscriptionDto })
  me(@CurrentUser() user: AuthUser): Promise<MySubscriptionDto> {
    return this.subscription.getMe(user.userId);
  }
}
