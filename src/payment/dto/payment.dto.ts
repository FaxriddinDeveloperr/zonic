// Payment DTOs (Phase L).
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 'click', enum: ['click', 'payme', 'uzum', 'mock'] })
  @IsIn(['click', 'payme', 'uzum', 'mock'])
  provider: string;

  @ApiProperty({
    example: 'subscription:gold',
    description: "What is being paid for, e.g. 'subscription:gold' | 'subscription:gold_plus'",
  })
  @IsString()
  purpose: string;
}

export class PaymentCreatedDto {
  @ApiProperty()
  paymentId: string;

  @ApiProperty({ example: 'click' })
  provider: string;

  @ApiProperty({ example: 15000 })
  amount: number;

  @ApiProperty({ example: 'UZS' })
  currency: string;

  @ApiProperty({ example: 'created' })
  status: string;

  @ApiProperty({ example: 'inv_ab12cd', description: 'Provider invoice id' })
  externalId: string;

  @ApiProperty({
    example: 'https://checkout.example/pay/inv_ab12cd',
    description: 'Where to send the user to pay (provider hosted page). Stubbed until keys are set.',
  })
  checkoutUrl: string;
}

export class PaymentWebhookDto {
  @ApiProperty({ example: 'inv_ab12cd', description: 'Provider invoice id' })
  @IsString()
  externalId: string;

  @ApiProperty({ example: 'paid', enum: ['paid', 'failed'] })
  @IsIn(['paid', 'failed'])
  status: string;
}

export class WebhookResultDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ example: 'paid' })
  status: string;
}
