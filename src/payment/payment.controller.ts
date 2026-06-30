// Routes under /Payment. Create is authenticated; the provider webhook is public (providers call
// it server-to-server) — in production it must be protected by provider signature verification.
import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { PaymentService } from './payment.service';
import {
  CreatePaymentDto,
  PaymentCreatedDto,
  PaymentWebhookDto,
  WebhookResultDto,
} from './dto/payment.dto';

@ApiTags('Payment')
@Controller('Payment')
export class PaymentController {
  constructor(private readonly payment: PaymentService) {}

  @Post('Create')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start a payment; returns a checkout URL (provider hosted)' })
  @ApiOkResponse({ type: PaymentCreatedDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto): Promise<PaymentCreatedDto> {
    return this.payment.create(user.userId, dto);
  }

  @Post('Webhook/:provider')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Provider payment callback — settles the payment and fulfils its purpose',
  })
  @ApiOkResponse({ type: WebhookResultDto })
  webhook(
    @Param('provider') provider: string,
    @Body() dto: PaymentWebhookDto,
  ): Promise<WebhookResultDto> {
    return this.payment.confirm(provider, dto.externalId, dto.status);
  }
}
